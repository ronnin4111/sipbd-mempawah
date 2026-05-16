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
    "dinas", "badan", "inspektorat", "sekretariat", "kepala",
    // NOTE: "pegawai" removed from stop words — it's an important search keyword
    // for personnel documents. Without it, keyword search can't find pegawai data.
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
 * Count unique employee/pegawai names in the knowledge base.
 * 
 * The data format in the KB is typically tab-separated:
 *   NAME<TAB>JABATAN<TAB>Gol/Ruang<TAB>NIP BARU
 * 
 * Each pegawai line has a NIP pattern (8+6+1+3 digit format like "19841022 200502 1 003")
 * or a Gol/Ruang pattern (like "Penata Tk. I / III d" or "Pembina / IV a").
 * 
 * This function counts lines that contain NIP or Gol/Ruang patterns,
 * which is the most reliable way to count employees regardless of
 * whether names are single-word or multi-word.
 */
export async function countUniquePegawai(): Promise<number> {
  const chunks = await db.knowledgeChunk.findMany({
    where: {
      document: { isActive: true },
    },
    select: {
      content: true,
    },
  });

  const names = new Set<string>();
  let nipLineCount = 0;

  for (const chunk of chunks) {
    const content = chunk.content;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Method 1: Count lines with NIP pattern (most reliable for pegawai data)
      // NIP format: YYYYMMDD YYYYMMDD X XXX (e.g., "19841022 200502 1 003")
      const hasNIP = /\d{8}\s+\d{6}\s+\d\s+\d{3}/.test(trimmedLine);
      if (hasNIP) {
        nipLineCount++;
        // Also try to extract the name from this line
        // Name is at the start of the line, before the first tab or double-space
        const nameMatch = trimmedLine.match(/^([A-Z][^\t]{2,}?)(?:\t|\s{2,}|")/);
        if (nameMatch) {
          let name = nameMatch[1].trim();
          // Clean up: remove title prefixes and degree suffixes
          name = cleanPegawaiName(name);
          if (name.length > 1) names.add(name.toLowerCase());
        }
        continue; // Don't count this line twice
      }

      // Method 2: Lines with Gol/Ruang pattern without NIP
      // (some lines might have Gol but no NIP if NIP is on a wrapped line)
      const hasGolongan = /\b(?:Pembina(?:\s+Tk\.\s*I)?|Penata(?:\s+Tk\.\s*I)?|Pengatur(?:\s+Tk\.\s*I)?|Juru(?:\s+Muda(?:\s+Tk\.\s*I)?)?)\s*\/?\s*(?:I{1,3}V?|IV)\s*[a-d]\b/i.test(trimmedLine);
      if (hasGolongan && !hasNIP) {
        nipLineCount++;
        const nameMatch = trimmedLine.match(/^([A-Z][^\t]{2,}?)(?:\t|\s{2,}|")/);
        if (nameMatch) {
          let name = nameMatch[1].trim();
          name = cleanPegawaiName(name);
          if (name.length > 1) names.add(name.toLowerCase());
        }
      }

      // Method 3: Numbered entries like "1. Name - Position"
      const numberedMatch = trimmedLine.match(/^\s*(\d+)[\.\)]\s+(.+?)\s+-/);
      if (numberedMatch) {
        let name = numberedMatch[2].trim();
        name = cleanPegawaiName(name);
        if (name.length > 1 &&
            !/^(Dinas|Kepala|Bidang|Seksi|Sub|Bagian|Daerah|Kabupaten|Kecamatan|Desa|Provinsi)/.test(name)) {
          names.add(name.toLowerCase());
        }
      }

      // Method 4: Name after "Nama" label
      const namaMatch = trimmedLine.match(/Nama\s*[:\-]\s*(.+)/i);
      if (namaMatch) {
        let name = namaMatch[1].trim();
        name = cleanPegawaiName(name);
        if (name.length > 1) names.add(name.toLowerCase());
      }
    }
  }

  // The NIP line count is the most reliable — one NIP = one pegawai.
  // Use the MAX of NIP count and unique names found.
  const count = Math.max(names.size, nipLineCount);
  console.log(`[KB] countUniquePegawai: uniqueNames=${names.size}, nipLines=${nipLineCount}, result=${count}`);
  return count;
}

/**
 * Clean a pegawai name by removing title prefixes and degree suffixes.
 * Examples:
 *   "Ir. M. Iqbal Suparta. MT" → "M. Iqbal Suparta"
 *   "Arifin, S.Pd.SD,.M.Pd" → "Arifin"
 *   "Hasto Priyarso, S.Pi" → "Hasto Priyarso"
 * 
 * Also filters out lines that are clearly NOT names (e.g., continuation of
 * jabatan descriptions like "Staf Bag. Perencanaan dan Keuangan").
 */
function cleanPegawaiName(name: string): string {
  // Remove common title prefixes: Ir., Drs., Dra., Dr., H., Hj.
  name = name.replace(/^(Ir\.\s*|Drs\.\s*|Dra\.\s*|Dr\.\s*|H\.\s*|Hj\.\s*)/i, '');
  // Remove suffixes with degrees after comma: "Arifin, S.Pd.SD,.M.Pd" → "Arifin"
  name = name.replace(/[,，].*$/, '');
  // Remove abbreviation suffixes after period+space: "M. Iqbal Suparta. MT" → "M. Iqbal Suparta"
  name = name.replace(/\.\s+[A-Z]{2,}.*$/, '');
  name = name.trim();

  // Filter out common non-name patterns (jabatan descriptions that wrap to next line)
  const nonNamePatterns = [
    /^(Staf|Staff)\s+(Bag|Seksi|Bidang|Sub)/i,
    /^(Fungsional|Pelaksana|Penyelenggara)\s+Umum/i,
    /^Bag\.\s*(Perencanaan|Umum|Keuangan)/i,
    /^Seksi\s+/i,
    /^Bidang\s+/i,
    /^Kabid\s+/i,
    /^Kasi\s+/i,
    /^Kasub\s+/i,
    /^Sub\s*Bag/i,
    /^dan\s+/i,
    /^Keuangan$/i,
    /^Perencanaan$/i,
    /^Perikanan$/i,
  ];
  for (const pattern of nonNamePatterns) {
    if (pattern.test(name)) return '';
  }

  return name;
}

/**
 * Get ALL chunks from employee/pegawai-related documents.
 * This is used for personnel questions where keyword-based search may miss
 * chunks that don't contain the exact search terms.
 * 
 * Returns all chunks from documents whose title or category suggests
 * they contain employee/pegawai data.
 * 
 * IMPORTANT: Does NOT use Prisma's `mode: 'insensitive'` because it's not
 * supported by SQLite/Turso. SQLite LIKE is case-insensitive for ASCII by default.
 */
export async function getAllPegawaiChunks(): Promise<string[]> {
  try {
    // Find documents that are likely to contain employee data
    // NOTE: No `mode: 'insensitive'` — SQLite LIKE is case-insensitive for ASCII
    const pegawaiDocs = await db.knowledgeDocument.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: 'pegawai' } },
          { title: { contains: 'Pegawai' } },
          { title: { contains: 'struktur' } },
          { title: { contains: 'Struktur' } },
          { title: { contains: 'organisasi' } },
          { title: { contains: 'karyawan' } },
          { title: { contains: 'kepegawaian' } },
          { category: { contains: 'umum' } },
          { category: { contains: 'Umum' } },
          { category: { contains: 'pegawai' } },
          { category: { contains: 'organisasi' } },
        ],
      },
      select: { id: true, title: true, category: true },
    });

    console.log(`[KB] getAllPegawaiChunks: found ${pegawaiDocs.length} candidate docs`);
    for (const doc of pegawaiDocs) {
      console.log(`[KB]   - Doc: "${doc.title}" (category: "${doc.category}")`);
    }

    if (pegawaiDocs.length === 0) {
      // Fallback: get ALL active documents and filter in JavaScript
      // This handles cases where Prisma contains doesn't match (encoding issues, etc.)
      console.log('[KB] getAllPegawaiChunks: no docs found via Prisma, trying JS fallback...');
      const allDocs = await db.knowledgeDocument.findMany({
        where: { isActive: true },
        select: { id: true, title: true, category: true },
      });
      const pegawaiKeywords = ['pegawai', 'struktur', 'organisasi', 'karyawan', 'kepegawaian', 'umum'];
      const fallbackDocs = allDocs.filter(doc => {
        const searchStr = (doc.title + ' ' + doc.category).toLowerCase();
        return pegawaiKeywords.some(kw => searchStr.includes(kw));
      });
      console.log(`[KB] getAllPegawaiChunks: JS fallback found ${fallbackDocs.length} docs`);
      if (fallbackDocs.length > 0) {
        return getChunksFromDocs(fallbackDocs);
      }
      return [];
    }

    return getChunksFromDocs(pegawaiDocs);
  } catch (error) {
    console.error('[KB] getAllPegawaiChunks error:', error);
    // Ultimate fallback: get all chunks and let the AI sort it out
    try {
      const allChunks = await db.knowledgeChunk.findMany({
        where: { document: { isActive: true } },
        include: { document: { select: { title: true, category: true } } },
        take: 100,
      });
      const pegawaiKeywords = ['pegawai', 'struktur', 'organisasi', 'karyawan', 'kepegawaian'];
      const filteredChunks = allChunks.filter(chunk => {
        const searchStr = (chunk.document.title + ' ' + chunk.document.category + ' ' + chunk.content).toLowerCase();
        return pegawaiKeywords.some(kw => searchStr.includes(kw));
      });
      console.log(`[KB] getAllPegawaiChunks: error fallback found ${filteredChunks.length} chunks`);
      return filteredChunks.map(
        (chunk) =>
          `[Sumber: ${chunk.document.title} (${chunk.document.category})${chunk.source ? ` - ${chunk.source}` : ""}]\n${chunk.content}`
      );
    } catch {
      return [];
    }
  }
}

/**
 * Helper: Get all chunks from a list of documents
 */
async function getChunksFromDocs(docs: Array<{ id: string; title: string; category: string }>): Promise<string[]> {
  const docIds = docs.map(d => d.id);
  
  const chunks = await db.knowledgeChunk.findMany({
    where: {
      documentId: { in: docIds },
      document: { isActive: true },
    },
    include: {
      document: { select: { title: true, category: true } },
    },
    orderBy: [
      { documentId: 'asc' },
      { chunkIndex: 'asc' },
    ],
  });

  console.log(`[KB] getChunksFromDocs: ${docs.length} docs, ${chunks.length} total chunks`);

  return chunks.map(
    (chunk) =>
      `[Sumber: ${chunk.document.title} (${chunk.document.category})${chunk.source ? ` - ${chunk.source}` : ""}]\n${chunk.content}`
  );
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
