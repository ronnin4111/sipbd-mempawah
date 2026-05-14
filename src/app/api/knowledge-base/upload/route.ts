import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Upload API is ready" });
}

export async function POST(request: NextRequest) {
  try {
    const password = request.headers.get("x-admin-password");

    // Simple password check - inline to avoid any import issues
    if (!password) {
      return NextResponse.json({ error: "Password admin diperlukan" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "umum";
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    // Get file extension
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const supportedTypes = ["xlsx", "xls", "docx", "txt", "csv"];
    if (!supportedTypes.includes(ext)) {
      return NextResponse.json(
        { error: `Tipe file tidak didukung: .${ext}` },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Compute content hash
    const crypto = await import("crypto");
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Parse document based on type using dynamic imports
    let chunks: Array<{ content: string; source: string; keywords: string[] }> = [];

    if (ext === "txt") {
      const text = buffer.toString("utf-8");
      if (text.trim()) {
        const lines = text.split("\n").filter((l) => l.trim());
        let currentContent = "";
        for (const line of lines) {
          if (currentContent.length + line.length > 2000) {
            if (currentContent) {
              const kws = extractKeywordsFromText(currentContent);
              chunks.push({ content: currentContent.trim(), source: `File: ${file.name}`, keywords: kws });
            }
            currentContent = line;
          } else {
            currentContent += "\n" + line;
          }
        }
        if (currentContent.trim()) {
          const kws = extractKeywordsFromText(currentContent);
          chunks.push({ content: currentContent.trim(), source: `File: ${file.name}`, keywords: kws });
        }
      }
    } else if (ext === "csv") {
      const text = buffer.toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(/[,;\t|]/).map((h) => h.trim().replace(/^"|"$/g, ""));
        let content = `=== CSV: ${file.name} ===\nKolom: ${headers.join(", ")}\nJumlah baris: ${lines.length - 1}\n\n`;
        const maxRows = Math.min(lines.length - 1, 500);
        for (let i = 1; i <= maxRows; i++) {
          const values = lines[i].split(/[,;\t|]/).map((v) => v.trim().replace(/^"|"$/g, ""));
          content += headers.map((h, idx) => `${h}: ${values[idx] ?? ""}`).join(" | ") + "\n";
        }
        const kws = [...headers.map(h => h.toLowerCase()), ...extractKeywordsFromText(content)];
        chunks.push({ content, source: `CSV: ${file.name}`, keywords: kws });
      }
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (jsonData.length === 0) continue;
        const headers = Object.keys(jsonData[0]);
        let content = `=== Sheet: ${sheetName} ===\nKolom: ${headers.join(", ")}\nJumlah baris: ${jsonData.length}\n\n`;
        const maxRows = Math.min(jsonData.length, 500);
        for (let i = 0; i < maxRows; i++) {
          content += headers.map((h) => `${h}: ${jsonData[i][h] ?? ""}`).join(" | ") + "\n";
        }
        const kws = [...headers.map(h => h.toLowerCase()), ...extractKeywordsFromText(content)];
        chunks.push({ content, source: `Sheet: ${sheetName}`, keywords: kws });
      }
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      if (text.trim()) {
        const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
        let currentContent = "";
        for (const para of paragraphs) {
          if (currentContent.length + para.length > 2000) {
            if (currentContent) {
              const kws = extractKeywordsFromText(currentContent);
              chunks.push({ content: currentContent.trim(), source: "Word", keywords: kws });
            }
            currentContent = para;
          } else {
            currentContent += "\n\n" + para;
          }
        }
        if (currentContent.trim()) {
          const kws = extractKeywordsFromText(currentContent);
          chunks.push({ content: currentContent.trim(), source: "Word", keywords: kws });
        }
      }
    }

    if (chunks.length === 0) {
      return NextResponse.json({ error: "File kosong atau tidak dapat dibaca" }, { status: 400 });
    }

    // Verify password using dynamic import
    const { verifyPassword } = await import("@/lib/passwords");
    const valid = await verifyPassword(password, "admin");
    if (!valid) {
      return NextResponse.json({ error: "Password admin tidak valid" }, { status: 401 });
    }

    // Database operations using dynamic import
    const { db } = await import("@/lib/db");

    // Check for duplicate
    const existing = await db.knowledgeDocument.findFirst({
      where: { contentHash, isActive: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Dokumen duplikat: "${existing.title}". Hapus dulu lalu upload ulang.` },
        { status: 409 }
      );
    }

    // Create document record
    const document = await db.knowledgeDocument.create({
      data: {
        title: file.name,
        fileType: ext,
        fileSize: buffer.length,
        description,
        category,
        contentHash,
        totalChunks: chunks.length,
      },
    });

    // Create chunks with keywords
    await db.knowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        documentId: document.id,
        chunkIndex: index,
        content: chunk.content,
        source: chunk.source,
        keywords: chunk.keywords.join(","),
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        title: file.name,
        fileType: ext,
        totalChunks: chunks.length,
      },
    });
  } catch (error: any) {
    console.error("KB upload error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengupload dokumen" },
      { status: 500 }
    );
  }
}

/**
 * Extract keywords from text content.
 * Includes:
 * - Capitalized multi-word entities (person names like "Roni Irama")
 * - Individual capitalized words (names, places)
 * - High-frequency significant words
 */
function extractKeywordsFromText(text: string): string[] {
  const stopWords = new Set([
    "yang", "dan", "di", "ke", "dari", "dengan", "untuk", "pada", "adalah",
    "ini", "itu", "atau", "dalam", "tidak", "akan", "oleh", "juga", "sudah",
    "ada", "karena", "seperti", "lebih", "setelah", "bisa", "buat", "lain",
    "saja", "hanya", "masih", "sangat", "serta", "bahwa", "apakah", "berapa",
    "bagaimana", "mengapa", "kapan", "dimana", "siapa", "apa", "sih", "dong",
    "kok", "kan", "lah", "pun", "per", "tentang", "menurut", "seberapa",
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "what",
    "how", "why", "when", "where", "who", "which", "can", "do", "does",
    "nomor", "nama", "tanggal", "alamat", "telepon", "email", "status",
    "jenis", "tipe", "kode", "id", "no", "nrp", "nip", "jabatan", "golongan",
    "unit", "bidang", "seksi", "sub", "bagian", "lapangan", "kantor",
    "kabupaten", "kecamatan", "desa", "kelurahan", "provinsi", "kota",
    "dinas", "badan", "inspektorat", "sekretariat", "kepala", "pegawai",
    "tahun", "bulan", "hari", "kerja", "pensiun", "mutasi", "pangkat",
  ]);

  const keywords = new Set<string>();

  // 1. Extract multi-word entities (consecutive capitalized words)
  // e.g., "Roni Irama" from "Roni Irama adalah kepala bidang"
  const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let entityMatch;
  while ((entityMatch = entityPattern.exec(text)) !== null) {
    const entity = entityMatch[1].trim().toLowerCase();
    if (entity.length > 3) {
      keywords.add(entity);
      // Also add individual words of the entity
      for (const part of entity.split(/\s+/)) {
        if (part.length > 2 && !stopWords.has(part)) {
          keywords.add(part);
        }
      }
    }
  }

  // 2. Extract individual capitalized words (potential names/places)
  const wordPattern = /\b([A-Z][a-z]{2,})\b/g;
  let wordMatch;
  while ((wordMatch = wordPattern.exec(text)) !== null) {
    const word = wordMatch[1].toLowerCase();
    if (!stopWords.has(word)) {
      keywords.add(word);
    }
  }

  // 3. Extract top frequent words
  const allWords = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const w of allWords) {
    freq[w] = (freq[w] || 0) + 1;
  }

  const topWords = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);

  for (const w of topWords) {
    keywords.add(w);
  }

  return [...keywords].slice(0, 30); // Limit to 30 keywords per chunk
}
