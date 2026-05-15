/**
 * Knowledge Base Service
 * Manages document storage, retrieval, and search for AI context injection
 *
 * KEY FIXES (v2):
 * - Search returns results from MULTIPLE documents (category diversity)
 * - Better keyword extraction (preserves multi-word entities like person names)
 * - Auto-extract keywords from content when keywords field is empty
 * - Higher max results for AI chat integration
 */

import { db } from "@/lib/db";

// Cache for knowledge base context (refreshed every 5 minutes)
let kbContextCache: { content: string; timestamp: number } | null = null;
const KB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string) {
  const doc = await db.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new Error("Dokumen tidak ditemukan");
  }

  // Cascade delete will remove chunks
  await db.knowledgeDocument.delete({
    where: { id: documentId },
  });

  // Invalidate cache
  invalidateKbCache();

  return { deleted: doc.title };
}

/**
 * List all documents with stats
 */
export async function listDocuments(category?: string) {
  const where = {
    isActive: true,
    ...(category && category !== "semua" ? { category } : {}),
  };

  const documents = await db.knowledgeDocument.findMany({
    where,
    include: {
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    description: doc.description,
    category: doc.category,
    totalChunks: doc.totalChunks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

/**
 * Extract keywords from text content.
 * Includes:
 * - Capitalized words (potential names/entities like "Roni Irama")
 * - Words longer than 3 chars (excluding stop words)
 * - Multi-word entities (consecutive capitalized words)
 */
export function extractKeywordsFromContent(text: string): string[] {
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
    const entity = entityMatch[1].trim();
    if (entity.length > 3 && !stopWords.has(entity.toLowerCase())) {
      keywords.add(entity.toLowerCase());
    }
  }

  // 2. Extract individual capitalized words (potential names/places)
  const wordPattern = /\b([A-Z][a-z]{2,})\b/g;
  let wordMatch;
  while ((wordMatch = wordPattern.exec(text)) !== null) {
    const word = wordMatch[1];
    if (!stopWords.has(word.toLowerCase())) {
      keywords.add(word.toLowerCase());
    }
  }

  // 3. Extract significant words (length > 3, not stop words)
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Count frequency
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Add top 15 most frequent words
  const topWords = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([w]) => w);

  for (const w of topWords) {
    keywords.add(w);
  }

  return [...keywords];
}

/**
 * Search knowledge base for relevant content based on a query.
 *
 * IMPORTANT: Returns results with DOCUMENT DIVERSITY — max N chunks per document.
 * This ensures that when searching for "Roni Irama", we get results from BOTH
 * the KUSUKA file AND the Data Pegawai file, not just the one with more mentions.
 */
export async function searchKnowledgeBase(
  query: string,
  maxResults: number = 8,
  maxPerDocument: number = 3
): Promise<string[]> {
  const queryKeywords = extractQueryKeywords(query);

  if (queryKeywords.length === 0) return [];

  // Get all active chunks
  const chunks = await db.knowledgeChunk.findMany({
    where: {
      document: { isActive: true },
    },
    include: {
      document: { select: { title: true, category: true } },
    },
  });

  if (chunks.length === 0) return [];

  // Score each chunk by keyword relevance
  const scored = chunks
    .map((chunk) => {
      const chunkKeywords = chunk.keywords
        ? chunk.keywords.toLowerCase().split(",").filter(Boolean)
        : [];
      const contentLower = chunk.content.toLowerCase();

      let score = 0;

      for (const kw of queryKeywords) {
        // Exact keyword match in stored keywords (high score)
        if (chunkKeywords.some((ck) => ck.trim() === kw || ck.trim().includes(kw))) {
          score += 15;
        }
        // Content contains keyword
        if (contentLower.includes(kw)) {
          score += 5;
          // Bonus for multiple occurrences
          const matches = contentLower.split(kw).length - 1;
          if (matches > 1) score += Math.min(matches * 2, 10);
        }
      }

      // Also search for multi-word entities from the query
      // e.g., "roni irama" as a combined term
      const queryLower = query.toLowerCase();
      const multiWordEntities = extractMultiWordEntities(query);
      for (const entity of multiWordEntities) {
        if (contentLower.includes(entity)) {
          score += 20; // High bonus for multi-word entity match
        }
        if (chunkKeywords.some((ck) => ck.includes(entity))) {
          score += 25; // Even higher for keyword match
        }
      }

      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Apply document diversity: max N chunks per document
  const docCount = new Map<string, number>();
  const diverseResults: typeof scored = [];

  for (const item of scored) {
    const docId = item.chunk.documentId;
    const currentCount = docCount.get(docId) || 0;
    if (currentCount < maxPerDocument) {
      diverseResults.push(item);
      docCount.set(docId, currentCount + 1);
    }
    if (diverseResults.length >= maxResults) break;
  }

  // Update access count for used chunks (fire and forget)
  for (const item of diverseResults) {
    db.knowledgeChunk.update({
      where: { id: item.chunk.id },
      data: { accessCount: { increment: 1 } },
    }).catch(() => {}); // Ignore errors
  }

  return diverseResults.map(
    (item) =>
      `[Sumber: ${item.chunk.document.title} (${item.chunk.document.category})${item.chunk.source ? ` - ${item.chunk.source}` : ""}]\n${item.chunk.content}`
  );
}

/**
 * Extract multi-word entities from a query.
 * E.g., "Apa jabatan Roni Irama?" → ["roni irama"]
 * This helps search find person names as complete units.
 */
function extractMultiWordEntities(query: string): string[] {
  const entities: string[] = [];

  // Match consecutive capitalized words (person names, place names, etc.)
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let match;
  while ((match = pattern.exec(query)) !== null) {
    entities.push(match[1].toLowerCase());
  }

  return entities;
}

/**
 * Get full Knowledge Base context for AI prompt injection
 * Cached for 5 minutes to avoid repeated DB queries
 */
export async function getKnowledgeBaseContext(
  forceRefresh: boolean = false
): Promise<string> {
  if (!forceRefresh && kbContextCache && Date.now() - kbContextCache.timestamp < KB_CACHE_TTL) {
    return kbContextCache.content;
  }

  // Get document summary
  const docCount = await db.knowledgeDocument.count({
    where: { isActive: true },
  });

  if (docCount === 0) {
    const empty = "";
    kbContextCache = { content: empty, timestamp: Date.now() };
    return empty;
  }

  // Get category breakdown
  const categories = await db.knowledgeDocument.groupBy({
    by: ["category"],
    where: { isActive: true },
    _count: { category: true },
  });

  const categorySummary = categories
    .map((c) => `${c.category}: ${c._count.category} dokumen`)
    .join(", ");

  // Get document list
  const docs = await db.knowledgeDocument.findMany({
    where: { isActive: true },
    select: { title: true, fileType: true, category: true, totalChunks: true },
    orderBy: { createdAt: "desc" },
  });

  const docList = docs
    .map((d) => `- ${d.title} (${d.fileType}, kategori: ${d.category}, ${d.totalChunks} bagian)`)
    .join("\n");

  const content = `\n\n=== BASIS PENGETAHUAN (${docCount} dokumen) ===\nKategori: ${categorySummary}\nDokumen:\n${docList}\n⚠️ PENTING: Jika pertanyaan user berkaitan dengan dokumen di Basis Pengetahuan, WAJIB cari dan gunakan data dari sana sebagai sumber UTAMA. JANGAN mengarang data yang tidak ada di Basis Pengetahuan.\n`;

  kbContextCache = { content, timestamp: Date.now() };
  return content;
}

/**
 * Get Knowledge Base stats
 */
export async function getKnowledgeBaseStats() {
  const [totalDocs, totalChunks, categoryBreakdown, recentDocs] = await Promise.all([
    db.knowledgeDocument.count({ where: { isActive: true } }),
    db.knowledgeChunk.count({ where: { document: { isActive: true } } }),
    db.knowledgeDocument.groupBy({
      by: ["category"],
      where: { isActive: true },
      _count: { category: true },
    }),
    db.knowledgeDocument.findMany({
      where: { isActive: true },
      select: { id: true, title: true, fileType: true, category: true, totalChunks: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalDocs,
    totalChunks,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      count: c._count.category,
    })),
    recentDocs,
  };
}

/**
 * Count total matching chunks for a query (without document diversity limit).
 * Used to provide accurate total counts to the AI, even when search results
 * are truncated. This prevents the AI from undercounting (e.g., saying 20
 * when the real total is 28).
 *
 * Returns the count of chunks that have a non-zero relevance score.
 */
export async function countMatchingChunks(query: string): Promise<number> {
  const queryKeywords = extractQueryKeywords(query);

  if (queryKeywords.length === 0) return 0;

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      document: { isActive: true },
    },
    select: {
      content: true,
      keywords: true,
    },
  });

  if (chunks.length === 0) return 0;

  let matchCount = 0;
  const multiWordEntities = extractMultiWordEntities(query);

  for (const chunk of chunks) {
    const chunkKeywords = chunk.keywords
      ? chunk.keywords.toLowerCase().split(",").filter(Boolean)
      : [];
    const contentLower = chunk.content.toLowerCase();

    let score = 0;

    for (const kw of queryKeywords) {
      if (chunkKeywords.some((ck) => ck.trim() === kw || ck.trim().includes(kw))) {
        score += 15;
      }
      if (contentLower.includes(kw)) {
        score += 5;
      }
    }

    for (const entity of multiWordEntities) {
      if (contentLower.includes(entity)) {
        score += 20;
      }
      if (chunkKeywords.some((ck) => ck.includes(entity))) {
        score += 25;
      }
    }

    if (score > 0) matchCount++;
  }

  return matchCount;
}

/**
 * Invalidate the KB context cache
 */
export function invalidateKbCache() {
  kbContextCache = null;
}

/**
 * Extract search keywords from a user query.
 * Improved: preserves multi-word entities, extracts names.
 */
function extractQueryKeywords(query: string): string[] {
  const stopWords = new Set([
    "yang", "dan", "di", "ke", "dari", "dengan", "untuk", "pada", "adalah",
    "ini", "itu", "atau", "dalam", "tidak", "akan", "oleh", "juga", "sudah",
    "ada", "karena", "seperti", "lebih", "setelah", "bisa", "buat", "lain",
    "saja", "hanya", "masih", "sangat", "serta", "bahwa", "apakah", "berapa",
    "bagaimana", "mengapa", "kapan", "dimana", "siapa", "apa", "sih", "dong",
    "kok", "kan", "lah", "pun", "per", "tentang", "menurut", "seberapa",
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "what",
    "how", "why", "when", "where", "who", "which", "can", "do", "does",
    "jabatan", "posisi", "peran", "fungsi", "tugas", // These are question context, not search terms
  ]);

  const keywords = new Set<string>();

  // 1. Extract multi-word entities (person names, place names)
  const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let entityMatch;
  while ((entityMatch = entityPattern.exec(query)) !== null) {
    const entity = entityMatch[1].toLowerCase();
    keywords.add(entity);
    // Also add individual words of the entity
    for (const part of entity.split(/\s+/)) {
      if (part.length > 2) keywords.add(part);
    }
  }

  // 2. Extract individual significant words
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  for (const w of words) {
    keywords.add(w);
  }

  return [...keywords];
}
