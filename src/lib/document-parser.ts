/**
 * Document Parser Service
 * Parses uploaded files (Excel, DOCX, TXT, CSV) into text chunks
 * for the Knowledge Base system.
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import crypto from "crypto";

export interface ParsedChunk {
  content: string;
  source: string; // sheet name, section, etc.
  keywords: string[];
}

export interface ParsedDocument {
  chunks: ParsedChunk[];
  contentHash: string;
  totalChunks: number;
}

// Maximum chunk size in characters (for AI context injection)
const MAX_CHUNK_SIZE = 2000;
// Overlap between chunks for better context continuity
const CHUNK_OVERLAP = 200;

/**
 * Parse a file buffer into structured chunks
 */
export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  fileType: string
): Promise<ParsedDocument> {
  const contentHash = computeHash(buffer);
  let chunks: ParsedChunk[];

  switch (fileType) {
    case "xlsx":
    case "xls":
      chunks = parseExcel(buffer);
      break;
    case "docx":
      chunks = await parseDocx(buffer);
      break;
    case "txt":
      chunks = parseText(buffer.toString("utf-8"), fileName);
      break;
    case "csv":
      chunks = parseCsv(buffer.toString("utf-8"), fileName);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  // If chunks are too large, split them further
  chunks = splitLargeChunks(chunks);

  return {
    chunks,
    contentHash,
    totalChunks: chunks.length,
  };
}

/**
 * Parse Excel file into chunks (one per sheet)
 */
function parseExcel(buffer: Buffer): ParsedChunk[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const chunks: ParsedChunk[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to JSON array for structured representation
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (jsonData.length === 0) continue;

    // Get headers
    const headers = Object.keys(jsonData[0]);

    // Build text representation
    let content = `=== Sheet: ${sheetName} ===\n`;
    content += `Kolom: ${headers.join(", ")}\n`;
    content += `Jumlah baris: ${jsonData.length}\n\n`;

    // Add data rows (limit to prevent massive chunks)
    const maxRows = Math.min(jsonData.length, 500);
    for (let i = 0; i < maxRows; i++) {
      const row = jsonData[i];
      const rowStr = headers
        .map((h) => `${h}: ${row[h] ?? ""}`)
        .join(" | ");
      content += `${rowStr}\n`;
    }

    if (jsonData.length > maxRows) {
      content += `\n... dan ${jsonData.length - maxRows} baris lainnya`;
    }

    // Extract keywords from headers and data
    const keywords = extractKeywords(
      `${sheetName} ${headers.join(" ")} ${jsonData
        .slice(0, 10)
        .map((r) => Object.values(r).join(" "))
        .join(" ")}`
    );

    chunks.push({
      content,
      source: `Sheet: ${sheetName}`,
      keywords,
    });
  }

  return chunks;
}

/**
 * Parse DOCX file into chunks
 */
async function parseDocx(buffer: Buffer): Promise<ParsedChunk[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  if (!text.trim()) {
    return [];
  }

  // Split by paragraphs/sections
  const paragraphs = text
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);

  const chunks: ParsedChunk[] = [];
  let currentContent = "";

  for (const paragraph of paragraphs) {
    if (currentContent.length + paragraph.length > MAX_CHUNK_SIZE) {
      if (currentContent) {
        chunks.push({
          content: currentContent.trim(),
          source: "Dokumen Word",
          keywords: extractKeywords(currentContent),
        });
      }
      currentContent = paragraph;
    } else {
      currentContent += "\n\n" + paragraph;
    }
  }

  if (currentContent.trim()) {
    chunks.push({
      content: currentContent.trim(),
      source: "Dokumen Word",
      keywords: extractKeywords(currentContent),
    });
  }

  return chunks;
}

/**
 * Parse plain text file into chunks
 */
function parseText(text: string, fileName: string): ParsedChunk[] {
  if (!text.trim()) return [];

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const chunks: ParsedChunk[] = [];
  let currentContent = "";
  let lineCount = 0;

  for (const line of lines) {
    if (currentContent.length + line.length > MAX_CHUNK_SIZE) {
      if (currentContent) {
        chunks.push({
          content: currentContent.trim(),
          source: `File: ${fileName} (baris 1-${lineCount})`,
          keywords: extractKeywords(currentContent),
        });
      }
      currentContent = line;
      lineCount = 1;
    } else {
      currentContent += "\n" + line;
      lineCount++;
    }
  }

  if (currentContent.trim()) {
    chunks.push({
      content: currentContent.trim(),
      source: `File: ${fileName}`,
      keywords: extractKeywords(currentContent),
    });
  }

  return chunks;
}

/**
 * Parse CSV file into chunks
 */
function parseCsv(text: string, fileName: string): ParsedChunk[] {
  if (!text.trim()) return [];

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // First line is likely headers
  const headers = lines[0].split(/[,;\t|]/).map((h) => h.trim().replace(/^"|"$/g, ""));

  let content = `=== File CSV: ${fileName} ===\n`;
  content += `Kolom: ${headers.join(", ")}\n`;
  content += `Jumlah baris: ${lines.length - 1}\n\n`;

  // Add data rows
  const maxRows = Math.min(lines.length - 1, 500);
  for (let i = 1; i <= maxRows; i++) {
    const values = lines[i].split(/[,;\t|]/).map((v) => v.trim().replace(/^"|"$/g, ""));
    const rowStr = headers
      .map((h, idx) => `${h}: ${values[idx] ?? ""}`)
      .join(" | ");
    content += `${rowStr}\n`;
  }

  if (lines.length - 1 > maxRows) {
    content += `\n... dan ${lines.length - 1 - maxRows} baris lainnya`;
  }

  const keywords = extractKeywords(
    `${fileName} ${headers.join(" ")} ${lines.slice(1, 11).join(" ")}`
  );

  return [
    {
      content,
      source: `File CSV: ${fileName}`,
      keywords,
    },
  ];
}

/**
 * Split chunks that exceed MAX_CHUNK_SIZE
 */
function splitLargeChunks(chunks: ParsedChunk[]): ParsedChunk[] {
  const result: ParsedChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.content.length <= MAX_CHUNK_SIZE) {
      result.push(chunk);
      continue;
    }

    // Split by sentences or lines
    const parts = chunk.content.split(/\n/);
    let current = "";

    for (const part of parts) {
      if (current.length + part.length > MAX_CHUNK_SIZE) {
        if (current) {
          result.push({
            content: current.trim(),
            source: chunk.source,
            keywords: extractKeywords(current),
          });
        }
        current = part;
      } else {
        current += "\n" + part;
      }
    }

    if (current.trim()) {
      result.push({
        content: current.trim(),
        source: chunk.source,
        keywords: extractKeywords(current),
      });
    }
  }

  return result;
}

/**
 * Extract keywords from text (simple keyword extraction)
 * - Remove common Indonesian stop words
 * - Keep meaningful terms
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "yang", "dan", "di", "ke", "dari", "dengan", "untuk", "pada", "adalah",
    "ini", "itu", "atau", "dalam", "tidak", "akan", "oleh", "juga", "sudah",
    "ada", "karena", "seperti", "lebih", "setelah", "bisa", "buat", "lain",
    "saja", "hanya", "masih", "sangat", "serta", "bahwa", "kemudian", "namun",
    "saat", "sebuah", "seorang", "sebagai", "melalui", "tentang", "antar",
    "secara", "tersebut", "berdasarkan", "masing", "mungkin", "apakah",
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "and", "but", "or", "nor",
    "not", "so", "yet", "both", "either", "neither", "each", "every",
    "all", "any", "few", "more", "most", "other", "some", "such", "no",
    "only", "own", "same", "than", "too", "very", "just", "because",
  ]);

  // Tokenize and filter
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency and take top keywords
  const keywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);

  return keywords;
}

/**
 * Compute SHA256 hash of a buffer
 */
function computeHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ["xlsx", "xls", "docx", "txt", "csv"].includes(ext);
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(fileName: string): string {
  const ext = getFileExtension(fileName);
  const names: Record<string, string> = {
    xlsx: "Excel (.xlsx)",
    xls: "Excel (.xls)",
    docx: "Word (.docx)",
    txt: "Text (.txt)",
    csv: "CSV (.csv)",
  };
  return names[ext] ?? ext;
}
