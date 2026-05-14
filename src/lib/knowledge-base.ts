/**
 * Knowledge Base Service
 * Manages document storage, retrieval, and search for AI context injection
 */

import { db } from "@/lib/db";
// NOTE: document-parser is NOT imported here to avoid build issues on Vercel/Turbopack.
// The upload route inlines its own document parsing logic with dynamic imports.

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
 * Search knowledge base for relevant content based on a query
 * Uses keyword matching + scoring
 */
export async function searchKnowledgeBase(
  query: string,
  maxResults: number = 5
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

  // Score each chunk by keyword relevance
  const scored = chunks
    .map((chunk) => {
      const chunkKeywords = chunk.keywords.toLowerCase().split(",");
      const contentLower = chunk.content.toLowerCase();

      let score = 0;

      // Keyword match scoring
      for (const kw of queryKeywords) {
        // Exact keyword match
        if (chunkKeywords.some((ck) => ck.includes(kw))) {
          score += 10;
        }
        // Content contains keyword
        if (contentLower.includes(kw)) {
          score += 5;
          // Bonus for multiple occurrences
          const matches = contentLower.split(kw).length - 1;
          if (matches > 1) score += Math.min(matches * 2, 10);
        }
      }

      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Update access count for used chunks
  for (const item of scored) {
    await db.knowledgeChunk.update({
      where: { id: item.chunk.id },
      data: { accessCount: { increment: 1 } },
    });
  }

  return scored.map(
    (item) =>
      `[Sumber: ${item.chunk.document.title}${item.chunk.source ? ` - ${item.chunk.source}` : ""}]\n${item.chunk.content}`
  );
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
    .map((d) => `- ${d.title} (${d.fileType}, ${d.category}, ${d.totalChunks} bagian)`)
    .join("\n");

  const content = `\n\n=== BASIS PENGETAHUAN (${docCount} dokumen) ===\nKategori: ${categorySummary}\nDokumen:\n${docList}\n`;

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
 * Invalidate the KB context cache
 */
export function invalidateKbCache() {
  kbContextCache = null;
}

/**
 * Extract search keywords from a user query
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
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}
