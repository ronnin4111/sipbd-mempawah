import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { retrieveMemories, storeMemories, extractMemoriesFromConversation, formatMemoriesForPrompt, clearMemories } from '@/lib/ai-memory';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';
import { searchKnowledgeBase, getKnowledgeBaseContext } from "@/lib/knowledge-base";

/**
 * Compact system prompt for SIPBD AI assistant.
 * Option B: Flexible — prioritize fishery, but can answer general questions.
 *
 * IMPORTANT: Do NOT hardcode kecamatan/fish types/etc — derive from data context.
 * The data context will provide the actual lists from the database.
 */
const BASE_SYSTEM_PROMPT = `Anda adalah Asisten AI Perikanan Budidaya (SIPBD AI), asisten ahli Dinas Pertanian Ketahanan Pangan dan Perikanan Kabupaten Mempawah, Kalimantan Barat.

Peran utama:
- Menjawab pertanyaan tentang data produksi perikanan budidaya di Kab. Mempawah
- Menganalisis tren, membandingkan kecamatan, memberikan rekomendasi
- Mencari data kelompok/pembudidaya spesifik dari konteks yang disediakan
- KUSUKA=Kartu Identitas Usaha Perikanan — data registrasi perorangan pembudidaya

Anda juga fleksibel:
- Pertanyaan umum tentang budidaya ikan, akuakultur, dll → jawab dengan pengetahuan Anda
- Pertanyaan di luar topik → jawab singkat, arahkan kembali ke perikanan budidaya 😊

Anda juga bisa menjawab pertanyaan tentang data registrasi KUSUKA perorangan, status kartu, dan detail alamat pembudidaya.

⚠️ BATAS DATA (DATA BOUNDARIES) — SANGAT PENTING:
- Sistem ini HANYA mencakup data Kabupaten Mempawah, Kalimantan Barat
- Daftar kecamatan yang tersedia akan dicantumkan di DATA CONTEXT — HANYA gunakan kecamatan yang ada di sana
- Daftar jenis ikan yang tersedia akan dicantumkan di DATA CONTEXT — HANYA gunakan jenis ikan yang ada di sana
- Tahun data yang tersedia akan dicantumkan di informasi "Tahun data tersedia di database"
- Jika user menanyakan kecamatan/tahun/jenis ikan yang TIDAK ada di DATA CONTEXT, katakan: "Data untuk [item] tidak tersedia" — JANGAN membuat data palsu untuk itu
- CONTOH: Jika user bertanya tentang "Weda Selatan" tapi itu TIDAK ada di daftar kecamatan DATA CONTEXT, katakan "Data untuk Kecamatan Weda Selatan tidak tersedia di sistem SIPBD Kab. Mempawah"
- JANGAN pernah menyebutkan kecamatan, desa, atau jenis ikan yang TIDAK ada di DATA CONTEXT, bahkan jika Anda tahu itu ada di dunia nyata

Aturan respons SANGAT PENTING:
- WAJIB bahasa Indonesia
- Angka format Indonesia (1.234.567 kg, Rp 25.000)
- ⚠️ ANTI-HALLUCINASI #1: JANGAN PERNAH mengarang/membuat angka yang TIDAK ADA di DATA CONTEXT. Jika DATA CONTEXT berkata "TIDAK ADA DATA", maka TIDAK ADA DATA — jangan membuat angka palsu.
- ⚠️ ANTI-HALLUCINASI #2: HANYA gunakan kategori yang ada di DATA CONTEXT. Jika hanya ada "Produksi Pembesaran" dan "Produksi Pembenihan", JANGAN membuat kategori lain seperti "Produksi Laut" atau "Produksi Air Tawar".
- ⚠️ ANTI-HALLUCINASI #3: JANGAN bilang "Mohon menunggu sambil saya mengakses database" — Anda TIDAK memiliki akses database secara langsung. Data sudah disediakan di DATA CONTEXT.
- ⚠️ JANGAN menyebutkan nama kecamatan/kelompok/ikan yang TIDAK ada di DATA CONTEXT
- Jika data tidak tersedia di konteks, katakan jujur "Data tidak tersedia di konteks yang diberikan" — JANGAN mengarang
- ⚠️ PENTING: Jika data ADA di DATA CONTEXT, JANGAN bilang data tidak tersedia. Data di DATA CONTEXT sudah diambil langsung dari database sesuai pertanyaan Anda.
- DATA CONTEXT berisi data yang SUDAH diquery dari database sesuai pertanyaan Anda. JANGAN bilang data tidak tersedia jika ada angka di DATA CONTEXT.
- Jika nama kelompok/pembudidaya tidak ditemukan, sarankan nama mirip dari DATA CONTEXT
- Daftar kelompok/kecamatan/desa HANYA dari data yang disediakan — JANGAN tebak
- Saat diminta daftar kelompok, GUNAKAN nomor urut sesuai DATA CONTEXT
- Jika ada nama kelompok yang sama di desa berbeda, SEBUTKAN keduanya dengan lokasinya
- JANGAN bilang "data tidak lengkap" atau "data tidak ada" — semua data kelompok dan anggota sudah disediakan lengkap di DATA CONTEXT
- Saat ditanya tentang kelompok pembenih/pembenihan atau pembesaran, gunakan RINGKASAN JENIS USAHA di DATA CONTEXT
- Saat ditanya tentang anggota kelompok, gunakan DAFTAR ANGGOTA yang disediakan di DATA CONTEXT
- Untuk pertanyaan tentang KUSUKA/registrasi perorangan, gunakan DATA KUSUKA di DATA CONTEXT

Istilah:
- RTP=Rumah Tangga Perikanan, KUSUKA=Kartu Identitas Usaha Perikanan — data registrasi perorangan pembudidaya
- CPIB=Cara Pembenihan Ikan Baik, CBIB=Cara Budidaya Ikan Baik
- Kelompok=poktan/pokdakan (kelompok pembudidaya ikan), Anggota=jumlah anggota kelompok
- Jenis Usaha: Pembesaran=membesarkan ikan untuk dikonsumsi, Pembenihan=memijahkan/menghasilkan benih ikan
- PENTING: "Desa" adalah alamat tempat tinggal pembudidaya, BUKAN alamat kelompok
  Satu kelompok bisa memiliki anggota dari beberapa desa
- MEMORI: Anda memiliki memori dari percakapan sebelumnya. Gunakan untuk jawaban yang lebih personal.
  Namun jika memori bertentangan dengan DATA CONTEXT, prioritaskan DATA CONTEXT (data DB lebih akurat).

VERIFIKASI WAJIB sebelum menjawab pertanyaan data:
1. Cari angka yang diminta di DATA CONTEXT
2. Jika angka DITEMUKAN → gunakan angka tersebut persis (jangan bulatkan, jangan ubah)
3. Jika angka TIDAK DITEMUKAN → katakan "Data tidak tersedia" — JANGAN tebak atau estimasi
4. JANGAN pernah menghitung/menjumlahkan angka yang tidak ada di DATA CONTEXT
5. Jika ragu, prioritaskan kejujuran: "Saya tidak menemukan data tersebut dalam konteks yang tersedia"`;

/**
 * Classify the user's question type to determine what data to include.
 *
 * IMPORTANT: 'specific' questions load verbose targeted results (all member names),
 * which makes the prompt very large. Counting/summary questions like "berapa jumlah
 * kelompok" should be 'stats' or 'general' so the AI answers from compact summaries
 * in the data context, not from the full member listings.
 */
function classifyQuestion(message: string): 'specific' | 'stats' | 'general' | 'comparison' {
  const lower = message.toLowerCase();

  // ============================================================
  // Counting/summary questions → 'stats' (NOT 'specific'!)
  // These can be answered from the compact data context summaries.
  // Loading targeted results for these just wastes tokens and causes failures.
  // ============================================================
  const countSummaryPatterns = [
    /berapa\s+(jumlah\s+)?kelompok/i,     // "berapa kelompok", "berapa jumlah kelompok"
    /berapa\s+(jumlah\s+)?(rtp|pembudidaya)/i,
    /berapa\s+(jumlah\s+)?kusuka/i,       // "berapa kusuka", "berapa jumlah kusuka"
    /total\s+(kelompok|rtp|pembudidaya|kusuka)/i,
    /jumlah\s+(kelompok|rtp|pembudidaya|kusuka)/i,
    /jumlah\s+anggota/i,                   // "jumlah anggota" = counting, not listing
  ];
  if (countSummaryPatterns.some(p => p.test(lower))) return 'stats';

  // Specific group/farmer questions — these need individual member details
  const specificPatterns = [
    /anggota\s+kelompok/i, /pembudidaya\s+\w+/i,
    /siapa\s+saja/i, /daftar\s+anggota/i, /nama\s+kelompok/i,
    /semua\s+kelompok/i, /seluruh\s+kelompok/i,
    /tampilkan\s+semua/i, /tampilkan\s+seluruh/i, /daftar\s+kelompok/i,
    /kelompok\s+(pembenih|pembenihan|pembesaran)/i,
    // NOTE: Removed standalone /pembenih|pembenihan|pembesaran/i — too broad.
    // It matched ANY mention of pembesaran, even in counting questions like
    // "berapa produksi pembesaran" which should be 'stats'.
    /nama\s+anggota/i, /anggota\s+dari/i,
    // KUSUKA-specific patterns
    /kusuka/i, /kartu\s+usaha/i, /registrasi/i, /pendaftaran/i,
    /perorangan/i, /pembenih\s+perorangan/i, /nama\s+pembudidaya/i,
    /alamat\s+pembudidaya/i,
    /status\s+kusuka/i, /draf\s+kusuka/i, /valid\s+kusuka/i,
  ];
  if (specificPatterns.some(p => p.test(lower))) return 'specific';

  // Comparison questions — multi-year or multi-region comparisons
  const comparisonPatterns = [
    /bandingkan/i, /perbandingan/i, /perbedaan/i, /compare/i,
    /vs\.?/i, /\d{4}\s*(vs|dengan|dan|terhadap)\s*\d{4}/i,
    /\d{4}\s*-\s*\d{4}/,  // "2024-2025" range
  ];
  if (comparisonPatterns.some(p => p.test(lower))) return 'comparison';

  // Stats/production/trend questions (but NOT kelompok listing questions)
  const statsPatterns = [
    /produksi/i, /tren/i, /statistik/i,
    /kecamatan.*tinggi/i, /kecamatan.*rendah/i, /perbandingan/i,
    /rtp/i, /cpib/i, /cbib/i, /pencapaian/i, /target/i,
    /naik/i, /turun/i, /kenaikan/i, /penurunan/i, /pertumbuhan/i,
    /jumlah\s+(pembudidaya|rtp|produksi)/i, /total\s+(pembudidaya|rtp|produksi)/i,
  ];
  if (statsPatterns.some(p => p.test(lower))) return 'stats';

  return 'general';
}

/**
 * Extract potential search keywords from the user's message.
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  // Skip business type queries — they're handled by the data context breakdown
  const isBizTypeQuery = /kelompok\s+(pembenih|pembenihan|pembesaran)/i.test(message) ||
    /^(berapa\s+)?(jumlah\s+)?(kelompok\s+)?(pembenih|pembenihan|pembesaran)/i.test(message);
  if (isBizTypeQuery) {
    // For business type queries, no search terms needed — data context has the breakdown
    return [];
  }

  const patterns = [
    /anggota\s+kelompok\s+([^\?,\.\!]+)/i,
    /kelompok\s+([^\?,\.\!]+)/i,
    /pembudidaya\s+([^\?,\.\!]+)/i,
    /kelompok\s+(\w+(?:\s+\w+)*)/i,
    /grup\s+([^\?,\.\!]+)/i,
    /["']([^"']+)["']/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1] && match[1].trim().length > 2) {
      terms.push(match[1].trim());
    }
  }

  // Proper nouns (capitalized words not in common set)
  const commonWords = new Set([
    'berapa', 'jumlah', 'anggota', 'kelompok', 'pembudidaya', 'siapa',
    'saja', 'apa', 'dimana', 'kapan', 'bagaimana', 'mengapa', 'yang',
    'di', 'ke', 'dari', 'dengan', 'untuk', 'pada', 'adalah', 'ini',
    'itu', 'dan', 'atau', 'tetapi', 'karena', 'jika', 'kalau', 'bisa',
    'ada', 'tidak', 'sudah', 'belum', 'akan', 'dapat', 'harus', 'perlu',
    'semua', 'setiap', 'lain', 'lainnya', 'total', 'data', 'produksi',
    'tahun', 'kecamatan', 'desa', 'ikan', 'jenis', 'usaha', 'rtp',
    'kusuka', 'cpib', 'cbib', 'halo', 'hai', 'hello', 'hi', 'tolong',
    'bantu', 'jelaskan', 'sebutkan', 'daftar', 'informasi', 'tentang',
    'kabupaten', 'mempawah', 'dinas', 'perikanan', 'budidaya',
    'seluruh', 'tampilkan', 'sebutkan',
    'pembenih', 'pembenihan', 'pembesaran',  // handled specially, not as search terms
    'registrasi', 'pendaftaran', 'perorangan', 'kartu',  // KUSUKA keywords, not search terms
  ]);

  const words = message.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^\w]/g, '');
    if (clean.length > 2 && clean[0] === clean[0].toUpperCase() && !commonWords.has(clean.toLowerCase())) {
      terms.push(clean);
    }
  }

  return [...new Set(terms)];
}

/**
 * Fallback kecamatan names — used only if DB query fails.
 * NOTE: "Weda Selatan" is NOT in Mempawah (it's in Halmahera!)
 * and has been removed. The DB-driven list is the source of truth.
 */
const FALLBACK_KECAMATAN = [
  'Siantan', 'Mempawah Hilir', 'Mempawah Hulu', 'Segedong',
  'Salo', 'Toho', 'Lubuk Bandung', 'Batu Ampar',
  'Terentang',
];

/**
 * Fallback fish type names — used only if DB query fails.
 */
const FALLBACK_FISH_TYPES = [
  'Nila', 'Lele', 'Mas', 'Patin', 'Gabus', 'Bawal',
  'Kerapu', 'Udang', 'Bandeng', 'Pari', 'Belanak',
  'Kakap', 'Napol', 'Barramundi',
];

/**
 * In-memory cache for dynamic lists from DB, with 5-minute TTL.
 * Avoids hitting the database on every request while still
 * staying up-to-date when new kecamatan/fish types are added.
 */
interface CachedList {
  values: string[];
  updatedAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let kecamatanCache: CachedList | null = null;
let fishTypeCache: CachedList | null = null;
let yearsCache: CachedList | null = null;

/**
 * Get distinct kecamatan names from the database.
 * Results are cached in memory for 5 minutes.
 * Falls back to FALLBACK_KECAMATAN if the DB query fails.
 */
async function getDynamicKecamatanList(): Promise<string[]> {
  if (kecamatanCache && Date.now() - kecamatanCache.updatedAt < CACHE_TTL_MS) {
    return kecamatanCache.values;
  }
  try {
    const result = await db.fishFarm.findMany({
      select: { kecamatan: true },
      distinct: ['kecamatan'],
      orderBy: { kecamatan: 'asc' },
    });
    const values = result.map(r => r.kecamatan).filter(Boolean);
    if (values.length > 0) {
      kecamatanCache = { values, updatedAt: Date.now() };
      console.log(`[parseQuestionContext] Loaded ${values.length} kecamatan from DB:`, values.join(', '));
      return values;
    }
  } catch (err) {
    console.error('[parseQuestionContext] DB query for kecamatan failed, using fallback:', err);
  }
  return FALLBACK_KECAMATAN;
}

/**
 * Get distinct fish type names from the database.
 * Results are cached in memory for 5 minutes.
 * Falls back to FALLBACK_FISH_TYPES if the DB query fails.
 */
async function getDynamicFishTypeList(): Promise<string[]> {
  if (fishTypeCache && Date.now() - fishTypeCache.updatedAt < CACHE_TTL_MS) {
    return fishTypeCache.values;
  }
  try {
    const result = await db.fishFarm.findMany({
      select: { fishType: true },
      distinct: ['fishType'],
      orderBy: { fishType: 'asc' },
    });
    const values = result.map(r => r.fishType).filter(Boolean);
    if (values.length > 0) {
      fishTypeCache = { values, updatedAt: Date.now() };
      console.log(`[parseQuestionContext] Loaded ${values.length} fish types from DB:`, values.join(', '));
      return values;
    }
  } catch (err) {
    console.error('[parseQuestionContext] DB query for fish types failed, using fallback:', err);
  }
  return FALLBACK_FISH_TYPES;
}

/**
 * Get available years from the database.
 * Returns distinct years sorted descending.
 * Results are cached in memory for 5 minutes.
 */
async function getAvailableYears(): Promise<number[]> {
  if (yearsCache && Date.now() - yearsCache.updatedAt < CACHE_TTL_MS) {
    return yearsCache.values.map(Number);
  }
  try {
    const result = await db.fishFarm.findMany({
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    const values = result.map(r => r.year).filter((y): y is number => typeof y === 'number');
    if (values.length > 0) {
      yearsCache = { values: values.map(String), updatedAt: Date.now() };
      console.log(`[getAvailableYears] Loaded ${values.length} years from DB:`, values.join(', '));
      return values;
    }
  } catch {
    // fall through
  }
  return [];
}

/**
 * Parsed question context — what the user is asking about,
 * extracted from the natural language question itself
 * (independent of UI filter state).
 */
interface QuestionContext {
  years: number[];
  kecamatan: string[];
  businessType: string[];
  fishType: string[];
  desa: string[];
  isComparison: boolean;
}

/**
 * Parse the user's question to extract contextual information
 * like years, kecamatan, fish types, etc.
 * This is used to override UI filters so the AI fetches
 * the right data regardless of what the UI shows.
 *
 * Uses dynamic lists from the database (cached for 5 min)
 * to avoid hardcoding kecamatan/fish types that may be wrong
 * (e.g. "Weda Selatan" which is in Halmahera, not Mempawah).
 */
async function parseQuestionContext(message: string): Promise<QuestionContext> {
  const ctx: QuestionContext = {
    years: [],
    kecamatan: [],
    businessType: [],
    fishType: [],
    desa: [],
    isComparison: false,
  };
  const lower = message.toLowerCase();
  const currentYear = new Date().getFullYear();

  // ===== Parse years =====
  // "tahun 2025", "data 2024", "tahun 2024 dan 2025"
  const explicitYearPattern = /(?:tahun|data|tahun\s+ini|tahun\s+lalu|tahun\s+kemarin)?\s*(\d{4})(?:\s*(?:dan|,|&)?\s*(\d{4}))*/gi;
  const explicitYears = new Set<number>();
  let yearMatch: RegExpExecArray | null;
  while ((yearMatch = explicitYearPattern.exec(lower)) !== null) {
    for (let i = 1; i < yearMatch.length; i++) {
      if (yearMatch[i]) {
        const y = parseInt(yearMatch[i], 10);
        if (y >= 2020 && y <= currentYear + 1) {
          explicitYears.add(y);
        }
      }
    }
  }

  // "2024-2026" range pattern
  const rangePattern = /(\d{4})\s*-\s*(\d{4})/;
  const rangeMatch = lower.match(rangePattern);
  if (rangeMatch) {
    const startY = parseInt(rangeMatch[1], 10);
    const endY = parseInt(rangeMatch[2], 10);
    if (startY < endY && endY - startY <= 10) {
      for (let y = startY; y <= endY; y++) {
        explicitYears.add(y);
      }
    }
  }

  // Relative year patterns
  if (/tahun\s+lalu|tahun\s+kemarin/i.test(lower)) {
    explicitYears.add(currentYear - 1);
  }
  if (/tahun\s+ini|tahun\s+sekarang|tahun\s+berjalan/i.test(lower)) {
    explicitYears.add(currentYear);
  }

  // "N tahun terakhir" pattern
  const nYearPattern = /(\d+)\s+tahun\s+terakhir/i;
  const nYearMatch = lower.match(nYearPattern);
  if (nYearMatch) {
    const n = parseInt(nYearMatch[1], 10);
    if (n >= 1 && n <= 10) {
      for (let i = 0; i < n; i++) {
        explicitYears.add(currentYear - i);
      }
    }
  }

  // "bandingkan 2024 vs 2025" / "perbandingan 2024 2025"
  const vsPattern = /(\d{4})\s*(?:vs|dengan|dan|terhadap)\s*(\d{4})/i;
  const vsMatch = lower.match(vsPattern);
  if (vsMatch) {
    const y1 = parseInt(vsMatch[1], 10);
    const y2 = parseInt(vsMatch[2], 10);
    if (y1 >= 2020 && y1 <= currentYear + 1) explicitYears.add(y1);
    if (y2 >= 2020 && y2 <= currentYear + 1) explicitYears.add(y2);
    ctx.isComparison = true;
  }

  // Check comparison keywords
  if (/bandingkan|perbandingan|perbedaan|compare/i.test(lower)) {
    ctx.isComparison = true;
  }

  ctx.years = [...explicitYears].sort((a, b) => a - b);

  // ===== Parse kecamatan =====
  const dynamicKecamatan = await getDynamicKecamatanList();
  for (const kec of dynamicKecamatan) {
    if (lower.includes(kec.toLowerCase())) {
      ctx.kecamatan.push(kec);
    }
  }
  // Fuzzy match: also check partial kecamatan names in the question
  // Build partial patterns dynamically from DB kecamatan names
  const kecPartialPatterns: Record<string, string[]> = {};
  for (const kec of dynamicKecamatan) {
    const patterns = [kec.toLowerCase()];
    // For multi-word kecamatan, add the last word as a partial pattern
    const parts = kec.split(' ');
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length > 3) patterns.push(part.toLowerCase());
      }
    }
    kecPartialPatterns[kec] = patterns;
  }
  for (const [kec, patterns] of Object.entries(kecPartialPatterns)) {
    if (ctx.kecamatan.includes(kec)) continue; // already matched
    for (const p of patterns) {
      if (lower.includes(p) && p.length > 3) { // avoid matching very short partials like 'hulu'
        ctx.kecamatan.push(kec);
        break;
      }
    }
  }

  // ===== Parse business type =====
  if (/pembenihan|pembenih/i.test(lower)) {
    ctx.businessType.push('Pembenihan');
  }
  if (/pembesaran/i.test(lower)) {
    ctx.businessType.push('Pembesaran');
  }

  // ===== Parse fish type =====
  const dynamicFishTypes = await getDynamicFishTypeList();
  for (const fish of dynamicFishTypes) {
    if (lower.includes(fish.toLowerCase())) {
      ctx.fishType.push(fish);
    }
  }

  // ===== Parse desa (capitalized words that might be desa names) =====
  const skipWords = new Set([
    ...dynamicKecamatan.map(k => k.toLowerCase()),
    'mempawah', 'kabupaten', 'dinas', 'perikanan', 'budidaya',
    'kelompok', 'pembudidaya', 'anggota', 'jumlah', 'berapa',
    'data', 'tahun', 'desa', 'kecamatan', 'ikan', 'jenis',
    'usaha', 'rtp', 'kusuka', 'produksi', 'pembesaran', 'pembenihan',
    ...dynamicFishTypes.map(f => f.toLowerCase()),
  ]);
  const words = message.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^\w]/g, '');
    if (clean.length > 2 && clean[0] === clean[0].toUpperCase() && !skipWords.has(clean.toLowerCase())) {
      ctx.desa.push(clean);
    }
  }

  return ctx;
}

/**
 * Resolve effective filters by merging question context with UI filters.
 * Question context takes PRIORITY over UI filters.
 * If user mentions "tahun 2025" → use 2025, regardless of UI filter.
 * If user doesn't mention any year → fall back to UI filter, then latest 2 years from DB.
 */
async function resolveEffectiveFilters(
  questionCtx: QuestionContext,
  uiFilters: {
    years: string[];
    kecamatan: string[];
    desa: string[];
    fishType: string[];
    containerType: string[];
    businessType: string[];
  }
): Promise<{
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}> {
  let resolvedYears: string[];

  if (questionCtx.years.length > 0) {
    // Question context has years → use them
    resolvedYears = questionCtx.years.map(String);
  } else if (uiFilters.years.length > 0) {
    // UI filter has years → use them
    resolvedYears = uiFilters.years;
  } else {
    // Neither has years → use latest 2 years from database
    // This prevents defaulting to just current year which may have incomplete data
    const availableYears = await getAvailableYears();
    if (availableYears.length > 0) {
      resolvedYears = availableYears.slice(0, 2).map(String);
    } else {
      // Fallback to current year if DB query fails
      resolvedYears = [String(new Date().getFullYear())];
    }
  }

  const resolved = {
    years: resolvedYears,
    // Kecamatan: question context > UI filter
    kecamatan: questionCtx.kecamatan.length > 0
      ? questionCtx.kecamatan
      : uiFilters.kecamatan,
    // Desa: question context > UI filter
    desa: questionCtx.desa.length > 0
      ? questionCtx.desa
      : uiFilters.desa,
    // Fish type: question context > UI filter
    fishType: questionCtx.fishType.length > 0
      ? questionCtx.fishType
      : uiFilters.fishType,
    // Container type: only from UI filter (rarely mentioned in questions)
    containerType: uiFilters.containerType,
    // Business type: question context > UI filter
    businessType: questionCtx.businessType.length > 0
      ? questionCtx.businessType
      : uiFilters.businessType,
  };

  return resolved;
}

/**
 * Build a human-readable description of the auto-detected question context,
 * to include in the data context header so the AI knows what scope was fetched.
 */
function buildContextHeader(questionCtx: QuestionContext): string {
  const parts: string[] = [];
  if (questionCtx.years.length > 0) {
    parts.push(`Tahun=${questionCtx.years.join(',')}`);
  }
  if (questionCtx.kecamatan.length > 0) {
    parts.push(`Kecamatan=${questionCtx.kecamatan.join(',')}`);
  }
  if (questionCtx.businessType.length > 0) {
    parts.push(`JenisUsaha=${questionCtx.businessType.join(',')}`);
  }
  if (questionCtx.fishType.length > 0) {
    parts.push(`JenisIkan=${questionCtx.fishType.join(',')}`);
  }
  if (questionCtx.desa.length > 0) {
    parts.push(`Desa=${questionCtx.desa.join(',')}`);
  }
  if (questionCtx.isComparison) {
    parts.push('Mode=Perbandingan');
  }
  return parts.length > 0
    ? `Konteks pertanyaan terdeteksi: ${parts.join(', ')}`
    : '';
}

/**
 * Fetch KUSUKA registration data context — summary of all registrations.
 * Provides aggregate statistics for AI to answer KUSUKA-related questions.
 */
async function fetchKusukaDataContext(): Promise<string> {
  try {
    const registrations = await db.kusukaRegistration.findMany();

    if (registrations.length === 0) {
      return '\n=== DATA KUSUKA (Registrasi Perorangan) ===\nTidak ada data registrasi KUSUKA.';
    }

    const total = registrations.length;

    // Count per status
    const statusCount = new Map<string, number>();
    for (const r of registrations) {
      const status = r.statusKusuka || '-';
      statusCount.set(status, (statusCount.get(status) || 0) + 1);
    }
    const statusLines = [...statusCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ');

    // Count per kecamatan
    const kecCount = new Map<string, number>();
    for (const r of registrations) {
      const kec = r.kecamatan || '-';
      kecCount.set(kec, (kecCount.get(kec) || 0) + 1);
    }
    const kecLines = [...kecCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([k, c]) => `${k}: ${c}`)
      .join(', ');

    // Count per profesi utama
    const profesiCount = new Map<string, number>();
    for (const r of registrations) {
      const p = r.profesiUtama || '-';
      profesiCount.set(p, (profesiCount.get(p) || 0) + 1);
    }
    const profesiLines = [...profesiCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([p, c]) => `${p}: ${c}`)
      .join(', ');

    // Count per bentuk usaha
    const bentukCount = new Map<string, number>();
    for (const r of registrations) {
      const b = r.bentukUsaha || '-';
      bentukCount.set(b, (bentukCount.get(b) || 0) + 1);
    }
    const bentukLines = [...bentukCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([b, c]) => `${b}: ${c}`)
      .join(', ');

    // Count with valid KUSUKA card number (16 digits)
    const validKusukaCard = registrations.filter(r => /^\d{16}$/.test((r.noKusuka || '').trim())).length;

    // Count with kelompok vs without kelompok (independent)
    const withKelompok = registrations.filter(r => r.namaKelompok && r.namaKelompok.trim() !== '').length;
    const withoutKelompok = total - withKelompok;

    // List unique kelompok with member counts
    const kelompokMap = new Map<string, number>();
    for (const r of registrations) {
      if (r.namaKelompok && r.namaKelompok.trim()) {
        const k = r.namaKelompok.trim();
        kelompokMap.set(k, (kelompokMap.get(k) || 0) + 1);
      }
    }
    const kelompokLines = [...kelompokMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30) // Limit to top 30 kelompok to keep compact
      .map(([k, c]) => `${k} (${c})`)
      .join(', ');
    const kelompokExtra = kelompokMap.size > 30 ? ` ...dan ${kelompokMap.size - 30} lagi` : '';

    const dataContext = `\n=== DATA KUSUKA (Registrasi Perorangan) ===
Total registran: ${total}
Per status: ${statusLines}
Per kecamatan: ${kecLines}
Per profesi utama: ${profesiLines}
Per bentuk usaha: ${bentukLines}
No.KUSUKA valid (16 digit): ${validKusukaCard}
Dengan kelompok: ${withKelompok}, Mandiri (tanpa kelompok): ${withoutKelompok}
Kelompok (${kelompokMap.size}): ${kelompokLines}${kelompokExtra}`;

    return dataContext;
  } catch (error) {
    console.error('Failed to fetch KUSUKA data context:', error);
    return '\n=== DATA KUSUKA ===\nGagal memuat data KUSUKA.';
  }
}

/**
 * Fetch targeted KUSUKA registration results based on search terms.
 * Returns full details for matching registrants.
 */
async function fetchKusukaTargetedResults(searchTerms: string[], questionType: string): Promise<string> {
  try {
    const registrations = await db.kusukaRegistration.findMany();

    if (registrations.length === 0) {
      return '';
    }

    // If no search terms but it's a specific KUSUKA question, return summary listing
    if (searchTerms.length === 0) {
      if (questionType === 'specific') {
        // Return a compact listing of all registrants (name, kec, status)
        const lines = registrations
          .sort((a, b) => a.nama.localeCompare(b.nama))
          .slice(0, 50) // Limit to keep prompt manageable
          .map((r, i) => `${i + 1}. ${r.nama} | Kec:${r.kecamatan} | Desa:${r.kelDesa} | ${r.bentukUsaha} | ${r.profesiUtama} | Status:${r.statusKusuka}`)
          .join('\n');
        const extra = registrations.length > 50 ? `\n...dan ${registrations.length - 50} registran lainnya` : '';
        return `\n=== DAFTAR REGISTRAN KUSUKA (${registrations.length} orang) ===\n${lines}${extra}`;
      }
      return '';
    }

    // Search for matching registrants
    const found: string[] = [];
    const matchedIds = new Set<string>();

    for (const term of searchTerms) {
      const q = term.toLowerCase();

      for (const r of registrations) {
        if (matchedIds.has(r.id)) continue;

        if (
          (r.nama && r.nama.toLowerCase().includes(q)) ||
          (r.kecamatan && r.kecamatan.toLowerCase().includes(q)) ||
          (r.kelDesa && r.kelDesa.toLowerCase().includes(q)) ||
          (r.namaKelompok && r.namaKelompok.toLowerCase().includes(q)) ||
          (r.noKusuka && r.noKusuka.toLowerCase().includes(q))
        ) {
          matchedIds.add(r.id);
          // Return full details for matched registrants
          const kelStr = r.namaKelompok ? `Kel:${r.namaKelompok}` : 'Mandiri';
          const noKusukaStr = r.noKusuka ? `No.KUSUKA:${r.noKusuka}` : 'No.KUSUKA:-';
          found.push(`${r.nama} | Kec:${r.kecamatan} | Desa:${r.kelDesa} | ${kelStr} | ${r.bentukUsaha} | ${r.profesiUtama} | ${noKusukaStr} | Alamat:${r.alamat || '-'} | Status:${r.statusKusuka}`);
        }
      }
    }

    if (found.length === 0) {
      return `\nHASIL PENCARIAN KUSUKA: Tidak ditemukan untuk "${searchTerms.join(', ')}". Coba periksa ejaan.`;
    }

    return `\n=== HASIL PENCARIAN KUSUKA (${found.length} ditemukan) ===\n${found.join('\n')}`;
  } catch (error) {
    console.error('Failed to fetch KUSUKA targeted results:', error);
    return '';
  }
}

/**
 * Fetch COMPACT data context — summary only, no individual group details.
 * Used for 'general' questions (greetings, non-data questions) to keep prompt small.
 * The AI can still answer basic questions like "what data do you have?"
 */
async function fetchCompactDataContext(year?: number): Promise<{
  dataContext: string;
  totalGroups: number;
}> {
  try {
    let targetYear = year;
    if (!targetYear) {
      const availableYears = await getAvailableYears();
      targetYear = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
    }
    const records = await db.fishFarm.findMany({ where: { year: targetYear } });

    if (records.length === 0) {
      return {
        dataContext: '\n=== DATA CONTEXT (Ringkasan) ===\nBelum ada data tahun ini.',
        totalGroups: 0,
      };
    }

    // Quick counts
    const groupKeys = new Set<string>();
    const kecSet = new Set<string>();
    const fishSet = new Set<string>();
    const bizSet = new Set<string>();
    let totalFarmers = 0;

    records.forEach(r => {
      if (r.groupName?.trim()) groupKeys.add(`${r.groupName.trim().toLowerCase()}|${r.kecamatan}`);
      kecSet.add(r.kecamatan);
      fishSet.add(r.fishType);
      bizSet.add(r.businessType);
      totalFarmers += r.farmerCount;
    });

    return {
      dataContext: `\n=== DATA CONTEXT (Ringkasan) ===
Total kelompok: ${groupKeys.size}
Total pembudidaya: ${totalFarmers}
Kecamatan: ${[...kecSet].sort().join(', ')}
Jenis ikan: ${[...fishSet].sort().join(', ')}
Jenis usaha: ${[...bizSet].sort().join(', ')}
Tahun data: ${targetYear}

CATATAN: Ini ringkasan saja. Untuk data detail kelompok/anggota, tanyakan secara spesifik.`,
      totalGroups: groupKeys.size,
    };
  } catch (error) {
    console.error('Failed to fetch compact data context:', error);
    return {
      dataContext: '\n=== DATA ===\nGagal memuat data.',
      totalGroups: 0,
    };
  }
}

/**
 * Fetch STATS data context — summaries + business breakdown, NO full group list.
 * Used for counting/summary questions like "berapa jumlah kelompok?" or "berapa kusuka?"
 * Includes business type breakdown and per-kecamatan counts, but NOT the verbose
 * individual group listing (which causes Groq 413 errors).
 */
async function fetchStatsDataContext(filters: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<{
  dataContext: string;
  totalGroups: number;
  totalFarmers: number;
  pembenihanCount: number;
  pembesaranCount: number;
}> {
  try {
    const where: Record<string, unknown> = {};
    if (filters.years.length > 0) {
      where.year = { in: filters.years.map(Number).filter(n => !isNaN(n)) };
    } else {
      // Default to latest available year from database instead of current year
      const availableYears = await getAvailableYears();
      where.year = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
    }
    if (filters.kecamatan.length > 0) where.kecamatan = { in: filters.kecamatan };
    if (filters.desa.length > 0) where.desa = { in: filters.desa };
    if (filters.fishType.length > 0) where.fishType = { in: filters.fishType };
    if (filters.businessType.length > 0) where.businessType = { in: filters.businessType };

    const records = await db.fishFarm.findMany({ where });

    if (records.length === 0) {
      return {
        dataContext: '\n=== DATA ===\nTidak ada data untuk filter yang dipilih.',
        totalGroups: 0, totalFarmers: 0, pembenihanCount: 0, pembesaranCount: 0,
      };
    }

    // Build group data for counting (but NOT for listing)
    const groupMap = new Map<string, {
      businessTypes: Set<string>; memberCount: number; rtpCount: number;
    }>();
    const allFarmerLatest = new Map<string, typeof records[0]>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { businessTypes: new Set(), memberCount: 0, rtpCount: 0 });
      }
      groupMap.get(key)!.businessTypes.add(r.businessType);

      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!allFarmerLatest.has(fid)) {
        allFarmerLatest.set(fid, r);
        groupMap.get(key)!.memberCount += r.farmerCount;
        groupMap.get(key)!.rtpCount += r.rtpCount;
      }
    });

    const kecList = [...new Set(records.map(r => r.kecamatan))].sort();
    const desaByKec = new Map<string, Set<string>>();
    records.forEach(r => {
      if (!desaByKec.has(r.kecamatan)) desaByKec.set(r.kecamatan, new Set());
      desaByKec.get(r.kecamatan)!.add(r.desa);
    });

    const fishTypeList = [...new Set(records.map(r => r.fishType))].sort();
    const businessTypeList = [...new Set(records.map(r => r.businessType))].sort();
    const containerTypeList = [...new Set(records.map(r => r.containerType))].sort();

    // Business type breakdown
    let pembesaranOnly = 0, pembenihanOnly = 0, bothBiz = 0;
    for (const group of groupMap.values()) {
      const hasPembesaran = group.businessTypes.has('Pembesaran');
      const hasPembenihan = group.businessTypes.has('Pembenihan');
      if (hasPembesaran && hasPembenihan) bothBiz++;
      else if (hasPembesaran) pembesaranOnly++;
      else if (hasPembenihan) pembenihanOnly++;
    }
    const pembenihanCount = pembenihanOnly + bothBiz;
    const pembesaranCount = pembesaranOnly + bothBiz;

    const totalGroups = groupMap.size;
    const totalFarmers = allFarmerLatest.size;

    // Per-kecamatan group count (use groupMap for unique groups, NOT raw records)
    const kecGroupCounts = new Map<string, Set<string>>();
    for (const [key, group] of groupMap) {
      const kec = group.kecamatan;
      if (!kecGroupCounts.has(kec)) kecGroupCounts.set(kec, new Set());
      kecGroupCounts.get(kec)!.add(key);
    }

    const kecDesaLines = [...desaByKec.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kec, desas]) => `${kec} (${[...desas].sort().join(', ')})`)
      .join(', ');

    const dataContext = `\n=== DATA CONTEXT (WAJIB: gunakan HANYA data ini, jangan mengarang) ===
Total kelompok: ${totalGroups}
Total pembudidaya: ${totalFarmers}

RINGKASAN JENIS USAHA:
- Kelompok Pembesaran saja: ${pembesaranOnly}
- Kelompok Pembenihan saja: ${pembenihanOnly}
- Kelompok Pembesaran+Pembenihan: ${bothBiz}
- Total kelompok Pembesaran (termasuk campuran): ${pembesaranCount}
- Total kelompok Pembenihan (termasuk campuran): ${pembenihanCount}

Kecamatan (${kecList.length}): ${kecList.join(', ')}
Desa per kecamatan: ${kecDesaLines}
Jenis ikan: ${fishTypeList.join(', ')}
Jenis usaha: ${businessTypeList.join(', ')}
Wadah budidaya: ${containerTypeList.join(', ')}

Kelompok per kecamatan: ${[...kecGroupCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kec, keys]) => `${kec} (${keys.size})`).join(', ')}

CATATAN: Untuk daftar nama kelompok atau anggota, tanyakan secara spesifik.`;

    return { dataContext, totalGroups, totalFarmers, pembenihanCount, pembesaranCount };
  } catch (error) {
    console.error('Failed to fetch stats data context:', error);
    return {
      dataContext: '\n=== DATA ===\nGagal memuat data.',
      totalGroups: 0, totalFarmers: 0, pembenihanCount: 0, pembesaranCount: 0,
    };
  }
}

/**
 * Fetch comprehensive data context — includes ALL groups with full details.
 * No artificial limit on group count so AI can answer "berapa total" and
 * "tampilkan semua" accurately.
 */
async function fetchFullDataContext(filters: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<{
  dataContext: string;
  kecamatanList: string[];
  totalGroups: number;
  totalFarmers: number;
  pembenihanCount: number;
  pembesaranCount: number;
}> {
  try {
    const where: Record<string, unknown> = {};

    if (filters.years.length > 0) {
      where.year = { in: filters.years.map(Number).filter(n => !isNaN(n)) };
    } else {
      // Default to latest available year from database instead of current year
      const availableYears = await getAvailableYears();
      where.year = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
    }

    if (filters.kecamatan.length > 0) where.kecamatan = { in: filters.kecamatan };
    if (filters.desa.length > 0) where.desa = { in: filters.desa };
    if (filters.fishType.length > 0) where.fishType = { in: filters.fishType };
    if (filters.businessType.length > 0) where.businessType = { in: filters.businessType };

    const records = await db.fishFarm.findMany({ where });

    if (records.length === 0) {
      return {
        dataContext: '\n=== DATA ===\nTidak ada data untuk filter yang dipilih.',
        kecamatanList: [],
        totalGroups: 0,
        totalFarmers: 0,
        pembenihanCount: 0,
        pembesaranCount: 0,
      };
    }

    // Build comprehensive group data
    // IMPORTANT: Grouping key is groupName + kecamatan ONLY (not desa).
    // "Desa" is the farmer's residential address, NOT the group's address.
    // A single kelompok can have members living in multiple desa.
    const groupMap = new Map<string, {
      name: string; kec: string; desaList: Set<string>;
      fishTypes: Set<string>; businessTypes: Set<string>;
      memberCount: number; rtpCount: number; kusukaCount: number;
    }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    // Also build all-farmer latest map for total farmer count
    const allFarmerLatest = new Map<string, typeof records[0]>();

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      // Group by name + kecamatan — desa is farmer's address, not group's
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kec: r.kecamatan, desaList: new Set(),
          fishTypes: new Set(), businessTypes: new Set(),
          memberCount: 0, rtpCount: 0, kusukaCount: 0,
        });
      }
      groupMap.get(key)!.desaList.add(r.desa);
      groupMap.get(key)!.fishTypes.add(r.fishType);
      groupMap.get(key)!.businessTypes.add(r.businessType);

      if (!farmerLatestByGroup.has(key)) farmerLatestByGroup.set(key, new Map());
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!farmerLatestByGroup.get(key)!.has(fid)) {
        farmerLatestByGroup.get(key)!.set(fid, r);
      }
      if (!allFarmerLatest.has(fid)) {
        allFarmerLatest.set(fid, r);
      }
    });

    // Calculate member/rtp/kusuka counts per group
    for (const [key, group] of groupMap) {
      const farmerMap = farmerLatestByGroup.get(key);
      if (farmerMap) {
        let mc = 0, rc = 0, kc = 0;
        for (const r of farmerMap.values()) {
          mc += r.farmerCount;
          rc += r.rtpCount;
          if (/^\d{16}$/.test(String(r.kusuka || '').trim())) kc++;
        }
        group.memberCount = mc;
        group.rtpCount = rc;
        group.kusukaCount = kc;
      }
    }

    // Derive kecamatan list from actual data
    const kecList = [...new Set(records.map(r => r.kecamatan))].sort();
    const desaByKec = new Map<string, Set<string>>();
    records.forEach(r => {
      if (!desaByKec.has(r.kecamatan)) desaByKec.set(r.kecamatan, new Set());
      desaByKec.get(r.kecamatan)!.add(r.desa);
    });

    const fishTypeList = [...new Set(records.map(r => r.fishType))].sort();
    const businessTypeList = [...new Set(records.map(r => r.businessType))].sort();
    const containerTypeList = [...new Set(records.map(r => r.containerType))].sort();

    // Business type breakdown
    let pembesaranOnly = 0, pembenihanOnly = 0, bothBiz = 0;
    for (const group of groupMap.values()) {
      const hasPembesaran = group.businessTypes.has('Pembesaran');
      const hasPembenihan = group.businessTypes.has('Pembenihan');
      if (hasPembesaran && hasPembenihan) bothBiz++;
      else if (hasPembesaran) pembesaranOnly++;
      else if (hasPembenihan) pembenihanOnly++;
    }

    // Build COMPLETE numbered group list — so AI knows exact count
    // Sort: primary sort by kecamatan, secondary by name for consistency
    const sortedGroups = Array.from(groupMap.values())
      .sort((a, b) => {
        const kecDiff = a.kec.localeCompare(b.kec);
        if (kecDiff !== 0) return kecDiff;
        return a.name.localeCompare(b.name);
      });

    // Numbered format — show kecamatan, desa, businessType per group
    // Member names are kept separate and included in targeted search only
    const groupLines = sortedGroups.map((g, i) => {
      const desaStr = [...g.desaList].sort().join(', ');
      const bizStr = [...g.businessTypes].sort().join('/');
      return `${i + 1}. ${g.name} (Kec:${g.kec}, Desa:${desaStr}) ${g.memberCount}org [${[...g.fishTypes].join(',')}] {${bizStr}}`;
    });

    const totalGroups = groupMap.size;
    const totalFarmers = allFarmerLatest.size;

    // Build kecamatan → desa mapping
    const kecDesaLines: string[] = [];
    for (const [kec, desas] of desaByKec) {
      kecDesaLines.push(`${kec}: ${[...desas].sort().join(', ')}`);
    }

    // Build kelompok per business type lists
    const pembenihanGroups = sortedGroups.filter(g => g.businessTypes.has('Pembenihan'));
    const pembesaranGroups = sortedGroups.filter(g => g.businessTypes.has('Pembesaran'));
    const pembenihanList = pembenihanGroups.map((g, i) => `${i + 1}. ${g.name} (Kec:${g.kec})`).join('\n');
    const pembesaranList = pembesaranGroups.map((g, i) => `${i + 1}. ${g.name} (Kec:${g.kec})`).join('\n');

    const dataContext = `\n=== DATA CONTEXT (WAJIB: gunakan HANYA data ini, jangan mengarang) ===
Total kelompok: ${totalGroups}
Total pembudidaya: ${totalFarmers}

RINGKASAN JENIS USAHA:
- Kelompok Pembesaran saja: ${pembesaranOnly}
- Kelompok Pembenihan saja: ${pembenihanOnly}
- Kelompok Pembesaran+Pembenihan: ${bothBiz}
- Total kelompok Pembesaran (termasuk campuran): ${pembesaranGroups.length}
- Total kelompok Pembenihan (termasuk campuran): ${pembenihanGroups.length}

DAFTAR KELOMPOK PEMBENIHAN (${pembenihanGroups.length} kelompok):
${pembenihanList}

DAFTAR KELOMPOK PEMBESARAN (${pembesaranGroups.length} kelompok):
${pembesaranList}

Kecamatan (${kecList.length}): ${kecList.join(', ')}
Desa per kecamatan:
${kecDesaLines.join('\n')}
Jenis ikan: ${fishTypeList.join(', ')}
Jenis usaha: ${businessTypeList.join(', ')}
Wadah budidaya: ${containerTypeList.join(', ')}

DAFTAR KELOMPOK LENGKAP (${totalGroups} kelompok — nomor | nama | kec | desa anggota | jumlah anggota | ikan | jenis usaha):
${groupLines.join('\n')}

CATATAN: Untuk daftar nama anggota kelompok, lihat HASIL PENCARIAN SPESIFIK di bawah.`;

    return { dataContext, kecamatanList: kecList, totalGroups, totalFarmers, pembenihanCount: pembenihanGroups.length, pembesaranCount: pembesaranGroups.length };
  } catch (error) {
    console.error('Failed to fetch data context:', error);
    return {
      dataContext: '\n=== DATA ===\nGagal memuat data. Jawab berdasarkan pengetahuan umum saja.',
      kecamatanList: [],
      totalGroups: 0,
      totalFarmers: 0,
      pembenihanCount: 0,
      pembesaranCount: 0,
    };
  }
}

/**
 * Fetch targeted search results with FULL member details.
 * Returns all matching groups and their members.
 * If searchTerms is empty but we have a question about groups, returns all groups with members.
 */
async function fetchTargetedResults(searchTerms: string[], questionType: string, filters?: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<string> {
  try {
    const where: Record<string, unknown> = {};
    // Use resolved filters if provided, otherwise fall back to latest available year
    if (filters && filters.years.length > 0) {
      where.year = { in: filters.years.map(Number).filter(n => !isNaN(n)) };
    } else {
      const availableYears = await getAvailableYears();
      where.year = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
    }
    if (filters?.kecamatan.length) where.kecamatan = { in: filters.kecamatan };
    if (filters?.desa.length) where.desa = { in: filters.desa };
    if (filters?.fishType.length) where.fishType = { in: filters.fishType };
    if (filters?.businessType.length) where.businessType = { in: filters.businessType };

    const records = await db.fishFarm.findMany({ where });

    const groupMap = new Map<string, {
      name: string; kecamatan: string; desaList: Set<string>;
      fishTypes: Set<string>; businessTypes: Set<string>;
      memberCount: number; rtpCount: number;
    }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kecamatan: r.kecamatan, desaList: new Set(),
          fishTypes: new Set(), businessTypes: new Set(),
          memberCount: 0, rtpCount: 0,
        });
      }
      groupMap.get(key)!.desaList.add(r.desa);
      groupMap.get(key)!.fishTypes.add(r.fishType);
      groupMap.get(key)!.businessTypes.add(r.businessType);

      if (!farmerLatestByGroup.has(key)) farmerLatestByGroup.set(key, new Map());
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!farmerLatestByGroup.get(key)!.has(fid)) {
        farmerLatestByGroup.get(key)!.set(fid, r);
      }
    });

    // Calculate member counts
    for (const [key, group] of groupMap) {
      const farmerMap = farmerLatestByGroup.get(key);
      if (farmerMap) {
        let mc = 0, rc = 0;
        for (const r of farmerMap.values()) {
          mc += r.farmerCount;
          rc += r.rtpCount;
        }
        group.memberCount = mc;
        group.rtpCount = rc;
      }
    }

    // Build helper to format group with members
    const formatGroupWithMembers = (key: string, group: typeof groupMap extends Map<string, infer V> ? V : never): string => {
      const groupFarmers = farmerLatestByGroup.get(key);
      const memberNames: string[] = [];
      if (groupFarmers) {
        for (const r of groupFarmers.values()) {
          memberNames.push(`${r.farmerName} (${r.fishType}/${r.businessType}, Desa: ${r.desa})`);
        }
      }
      const desaStr = [...group.desaList].sort().join(', ');
      return `Kelompok: ${group.name} | Kec: ${group.kecamatan} | Desa anggota: ${desaStr} | Anggota: ${group.memberCount} | RTP: ${group.rtpCount} | Ikan: ${[...group.fishTypes].join(',')} | Usaha: ${[...group.businessTypes].join(',')}\n  Daftar anggota: ${memberNames.join('; ')}`;
    };

    // If no search terms but it's a specific question, include ALL groups with members
    if (searchTerms.length === 0) {
      if (questionType === 'specific') {
        // Include all groups with their member names
        const allGroupLines = Array.from(groupMap.entries())
          .sort(([,a], [,b]) => {
            const kecDiff = a.kecamatan.localeCompare(b.kecamatan);
            if (kecDiff !== 0) return kecDiff;
            return a.name.localeCompare(b.name);
          })
          .map(([key, group]) => formatGroupWithMembers(key, group));
        return '\n=== DATA ANGGOTA KELOMPOK (semua kelompok dengan daftar anggota) ===\n' + allGroupLines.join('\n');
      }
      return '';
    }

    // Search for matching groups — FULL details with ALL members
    const foundGroups: string[] = [];
    const foundFarmers: string[] = [];
    const matchedGroupKeys = new Set<string>();

    for (const term of searchTerms) {
      const q = term.toLowerCase();

      for (const [key, group] of groupMap) {
        if (
          group.name.toLowerCase().includes(q) ||
          group.kecamatan.toLowerCase().includes(q) ||
          [...group.desaList].some(d => d.toLowerCase().includes(q)) ||
          [...group.fishTypes].some(f => f.toLowerCase().includes(q)) ||
          [...group.businessTypes].some(b => b.toLowerCase().includes(q)) ||
          (q === 'pembenih' && [...group.businessTypes].some(b => b.toLowerCase() === 'pembenihan'))
        ) {
          if (matchedGroupKeys.has(key)) continue;
          matchedGroupKeys.add(key);
          foundGroups.push(formatGroupWithMembers(key, group));
        }
      }

      // Search farmers by name
      const allFarmerLatest = new Map<string, typeof records[0]>();
      for (const r of sortedDesc) {
        const fid = r.farmerId || generateFarmerId({
          farmerName: r.farmerName || '', groupName: r.groupName || '',
          kecamatan: r.kecamatan || '', desa: r.desa || '',
        });
        if (!allFarmerLatest.has(fid)) allFarmerLatest.set(fid, r);
      }

      for (const r of allFarmerLatest.values()) {
        if (
          (r.farmerName?.toLowerCase().includes(q)) ||
          (r.kecamatan?.toLowerCase().includes(q)) ||
          (r.desa?.toLowerCase().includes(q))
        ) {
          foundFarmers.push(
            `${r.farmerName} | Kel: ${r.groupName} | Kec: ${r.kecamatan} | ${r.fishType}/${r.businessType}`
          );
        }
      }
    }

    if (foundGroups.length === 0 && foundFarmers.length === 0) {
      return `\nHASIL PENCARIAN: Tidak ditemukan untuk "${searchTerms.join(', ')}". Coba periksa ejaan.`;
    }

    let result = '\n=== HASIL PENCARIAN SPESIFIK ===';
    if (foundGroups.length > 0) {
      result += '\nKelompok ditemukan:\n' + foundGroups.join('\n');
    }
    if (foundFarmers.length > 0) {
      result += '\nPembudidaya ditemukan:\n' + foundFarmers.slice(0, 50).join('\n');
    }
    return result;
  } catch (error) {
    console.error('Failed to fetch targeted results:', error);
    return '';
  }
}

/**
 * Fetch multi-year comparison context for side-by-side data.
 * Generates per-year summary (groups, farmers, production) for each year
 * in the resolved filters. Keeps it compact to avoid token overflow.
 */
async function fetchMultiYearComparisonContext(resolvedFilters: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<string> {
  try {
    let years: number[];
    if (resolvedFilters.years.length > 0) {
      years = resolvedFilters.years.map(Number).filter(n => !isNaN(n));
    } else {
      // Default to latest 2 years from database instead of current year
      const availableYears = await getAvailableYears();
      years = availableYears.length >= 2
        ? availableYears.slice(0, 2)
        : availableYears.length === 1
          ? [availableYears[0], availableYears[0] - 1]
          : [new Date().getFullYear()];
    }

    if (years.length < 2) {
      // Need at least 2 years for comparison; add previous year
      years.unshift(years[0] - 1);
    }

    const lines: string[] = ['\n=== DATA PERBANDINGAN MULTI-TAHUN (LANGSUNG DARI DATABASE) ==='];
    lines.push('⚠️ PENTING: Data di bawah adalah data RESMI dari database. Gunakan ANGKA PERSIS seperti yang tercantum — JANGAN mengarang, membulatkan, atau mengubah satuan.');
    lines.push('⚠️ JANGAN gunakan kategori yang TIDAK ADA di bawah (misalnya "Produksi Laut", "Produksi Air Tawar"). Kategori yang ada HANYA: Produksi Pembesaran (Kg) dan Produksi Pembenihan (Ekor).');
    lines.push('⚠️ Jika data untuk suatu tahun TIDAK ADA di bawah, katakan "Data tahun tersebut tidak tersedia" — JANGAN membuat angka palsu.');

    // Collect per-year data for comparison table
    interface YearData {
      year: number;
      hasData: boolean;
      totalGroups: number;
      totalFarmers: number;
      totalRtp: number;
      totalPembesaranProd: number;
      totalPembenihanProd: number;
      pembesaranOnly: number;
      pembenihanOnly: number;
      bothBiz: number;
      totalKusuka: number;
      kecSummary: string;
      fishTypeSummary: string;
    }
    const yearDataList: YearData[] = [];

    for (const year of years) {
      const where: Record<string, unknown> = { year };
      if (resolvedFilters.kecamatan.length > 0) where.kecamatan = { in: resolvedFilters.kecamatan };
      if (resolvedFilters.desa.length > 0) where.desa = { in: resolvedFilters.desa };
      if (resolvedFilters.fishType.length > 0) where.fishType = { in: resolvedFilters.fishType };
      if (resolvedFilters.businessType.length > 0) where.businessType = { in: resolvedFilters.businessType };

      const records = await db.fishFarm.findMany({ where });

      if (records.length === 0) {
        lines.push(`\n--- Tahun ${year}: ⛔ TIDAK ADA DATA di database untuk tahun ini. JANGAN membuat angka palsu untuk tahun ini. ---`);
        yearDataList.push({
          year, hasData: false, totalGroups: 0, totalFarmers: 0, totalRtp: 0,
          totalPembesaranProd: 0, totalPembenihanProd: 0,
          pembesaranOnly: 0, pembenihanOnly: 0, bothBiz: 0, totalKusuka: 0,
          kecSummary: '', fishTypeSummary: '',
        });
        continue;
      }

      lines.push(`\n--- Tahun ${year}: Data ditemukan (${records.length} record) ---`);

      // Build group data
      const groupMap = new Map<string, { businessTypes: Set<string>; memberCount: number; rtpCount: number; }>();
      const allFarmerLatest = new Map<string, typeof records[0]>();
      const sortedDesc = [...records].sort((a, b) => b.year - a.year);

      let totalPembesaranProd = 0;
      let totalPembenihanProd = 0;

      // Per fish type production
      const fishTypeProd = new Map<string, { pembesaran: number; pembenihan: number }>();

      records.forEach(r => {
        if (!r.groupName?.trim()) return;
        const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { businessTypes: new Set(), memberCount: 0, rtpCount: 0 });
        }
        groupMap.get(key)!.businessTypes.add(r.businessType);

        const fid = r.farmerId || generateFarmerId({
          farmerName: r.farmerName || '', groupName: r.groupName || '',
          kecamatan: r.kecamatan || '', desa: r.desa || '',
        });
        if (!allFarmerLatest.has(fid)) {
          allFarmerLatest.set(fid, r);
          groupMap.get(key)!.memberCount += r.farmerCount;
          groupMap.get(key)!.rtpCount += r.rtpCount;
        }

        // Sum production
        if (r.businessType === 'Pembesaran') {
          totalPembesaranProd += (r.productionQty || 0);
          // Track per fish type
          const ft = r.fishType || 'Lainnya';
          if (!fishTypeProd.has(ft)) fishTypeProd.set(ft, { pembesaran: 0, pembenihan: 0 });
          fishTypeProd.get(ft)!.pembesaran += (r.productionQty || 0);
        } else if (r.businessType === 'Pembenihan') {
          totalPembenihanProd += (r.productionQty || 0);
          const ft = r.fishType || 'Lainnya';
          if (!fishTypeProd.has(ft)) fishTypeProd.set(ft, { pembesaran: 0, pembenihan: 0 });
          fishTypeProd.get(ft)!.pembenihan += (r.productionQty || 0);
        }
      });

      // Business type breakdown
      let pembesaranOnly = 0, pembenihanOnly = 0, bothBiz = 0;
      for (const group of groupMap.values()) {
        const hasPembesaran = group.businessTypes.has('Pembesaran');
        const hasPembenihan = group.businessTypes.has('Pembenihan');
        if (hasPembesaran && hasPembenihan) bothBiz++;
        else if (hasPembesaran) pembesaranOnly++;
        else if (hasPembenihan) pembenihanOnly++;
      }

      // Count KUSUKA
      const totalKusuka = allFarmerLatest.values()
        ? [...allFarmerLatest.values()].filter(r => /^\d{16}$/.test(String(r.kusuka || '').trim())).length
        : 0;

      // Per-kecamatan summary
      const kecGroupCounts = new Map<string, number>();
      const kecFarmerCounts = new Map<string, number>();
      for (const r of records) {
        if (!r.groupName?.trim()) continue;
        kecGroupCounts.set(r.kecamatan, (kecGroupCounts.get(r.kecamatan) || 0) + 1);
      }
      for (const r of allFarmerLatest.values()) {
        kecFarmerCounts.set(r.kecamatan, (kecFarmerCounts.get(r.kecamatan) || 0) + r.farmerCount);
      }
      const kecSummary = [...kecGroupCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kec, count]) => `${kec}(${count}kel, ${kecFarmerCounts.get(kec) || 0}org)`)
        .join(', ');

      // Fish type summary
      const fishTypeSummary = [...fishTypeProd.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ft, prod]) => `${ft}: Pembesaran=${prod.pembesaran.toLocaleString('id-ID')}Kg, Pembenihan=${prod.pembenihan.toLocaleString('id-ID')}Ekor`)
        .join('; ');

      lines.push(`\n--- Tahun ${year} ---`);
      lines.push(`Kelompok: ${groupMap.size} (Pembesaran:${pembesaranOnly}, Pembenihan:${pembenihanOnly}, Campuran:${bothBiz})`);
      lines.push(`Pembudidaya: ${allFarmerLatest.size}, RTP: ${records.reduce((sum, r) => sum + r.rtpCount, 0)}, KUSUKA valid: ${totalKusuka}`);
      lines.push(`Produksi Pembesaran: ${totalPembesaranProd.toLocaleString('id-ID')} Kg`);
      lines.push(`Produksi Pembenihan: ${totalPembenihanProd.toLocaleString('id-ID')} Ekor`);
      if (fishTypeSummary) lines.push(`Per jenis ikan: ${fishTypeSummary}`);
      if (kecSummary) lines.push(`Per kecamatan: ${kecSummary}`);

      yearDataList.push({
        year, hasData: true,
        totalGroups: groupMap.size,
        totalFarmers: allFarmerLatest.size,
        totalRtp: records.reduce((sum, r) => sum + r.rtpCount, 0),
        totalPembesaranProd,
        totalPembenihanProd,
        pembesaranOnly,
        pembenihanOnly,
        bothBiz,
        totalKusuka,
        kecSummary,
        fishTypeSummary,
      });
    }

    // ============================================================
    // CRITICAL FIX: Add SIDE-BY-SIDE COMPARISON TABLE with real
    // calculated numbers so the AI doesn't have to compute or guess.
    // This prevents hallucination — the AI just reads the table.
    // ============================================================
    if (yearDataList.filter(y => y.hasData).length >= 2) {
      lines.push('\n--- TABEL PERBANDINGAN (angka resmi dari database) ---');
      const header = 'Indikator';
      const yearHeaders = yearDataList.map(y => `Tahun ${y.year}`).join(' | ');
      lines.push(`${header} | ${yearHeaders}`);
      lines.push('--- | ' + yearDataList.map(() => '---').join(' | '));

      // Row helper
      const row = (label: string, values: string[]) => `${label} | ${values.join(' | ')}`;
      // Change helper
      const change = (old: number, nw: number): string => {
        if (old === 0 && nw === 0) return '-';
        if (old === 0) return 'N/A (divisi nol)';
        const pct = ((nw - old) / old * 100).toFixed(1);
        const sign = Number(pct) >= 0 ? '+' : '';
        return `${sign}${pct}%`;
      };

      lines.push(row('Jumlah Kelompok', yearDataList.map(y => y.hasData ? String(y.totalGroups) : 'N/A')));
      lines.push(row('Pembudidaya', yearDataList.map(y => y.hasData ? String(y.totalFarmers) : 'N/A')));
      lines.push(row('RTP', yearDataList.map(y => y.hasData ? String(y.totalRtp) : 'N/A')));
      lines.push(row('KUSUKA valid', yearDataList.map(y => y.hasData ? String(y.totalKusuka) : 'N/A')));
      lines.push(row('Produksi Pembesaran (Kg)', yearDataList.map(y => y.hasData ? y.totalPembesaranProd.toLocaleString('id-ID') : 'N/A')));
      lines.push(row('Produksi Pembenihan (Ekor)', yearDataList.map(y => y.hasData ? y.totalPembenihanProd.toLocaleString('id-ID') : 'N/A')));

      // Add percentage changes between consecutive years
      if (yearDataList.length === 2 && yearDataList[0].hasData && yearDataList[1].hasData) {
        const y1 = yearDataList[0];
        const y2 = yearDataList[1];
        lines.push('');
        lines.push(`--- PERUBAHAN ${y1.year} → ${y2.year} (dihitung dari angka di atas) ---`);
        lines.push(`Jumlah Kelompok: ${y1.totalGroups} → ${y2.totalGroups} (${change(y1.totalGroups, y2.totalGroups)})`);
        lines.push(`Pembudidaya: ${y1.totalFarmers} → ${y2.totalFarmers} (${change(y1.totalFarmers, y2.totalFarmers)})`);
        lines.push(`RTP: ${y1.totalRtp} → ${y2.totalRtp} (${change(y1.totalRtp, y2.totalRtp)})`);
        lines.push(`Produksi Pembesaran: ${y1.totalPembesaranProd.toLocaleString('id-ID')} → ${y2.totalPembesaranProd.toLocaleString('id-ID')} Kg (${change(y1.totalPembesaranProd, y2.totalPembesaranProd)})`);
        lines.push(`Produksi Pembenihan: ${y1.totalPembenihanProd.toLocaleString('id-ID')} → ${y2.totalPembenihanProd.toLocaleString('id-ID')} Ekor (${change(y1.totalPembenihanProd, y2.totalPembenihanProd)})`);
      }
    } else if (yearDataList.filter(y => y.hasData).length === 1) {
      const withData = yearDataList.find(y => y.hasData)!;
      const withoutData = yearDataList.find(y => !y.hasData);
      lines.push('\n--- CATATAN PENTING ---');
      lines.push(`Data hanya tersedia untuk tahun ${withData.year}. Tahun ${withoutData?.year || 'lainnya'} TIDAK ADA DATA di database.`);
      lines.push('JANGAN membuat angka palsu untuk tahun yang tidak ada datanya. Katakan "Data tidak tersedia" untuk tahun tersebut.');
    }

    return lines.join('\n');
  } catch (error) {
    console.error('Failed to fetch multi-year comparison context:', error);
    return '\n=== DATA PERBANDINGAN ===\nGagal memuat data perbandingan. Katakan "Maaf, gagal memuat data perbandingan" dan JANGAN mengarang angka.';
  }
}

/**
 * Build compact stats summary from the client-side stats context.
 */
function buildCompactStats(statsContext?: Record<string, unknown>): string {
  if (!statsContext || Object.keys(statsContext).length === 0) return '';

  const s = statsContext;
  const lines: string[] = ['\n=== STATISTIK ==='];

  if (s.periodLabel) lines.push(`Periode: ${s.periodLabel}`);
  if (s.currentYear) lines.push(`Tahun: ${s.currentYear}`);

  if (s.pembesaranProduction !== undefined) {
    lines.push(`Produksi Pembesaran: ${Number(s.pembesaranProduction).toLocaleString('id-ID')} Kg`);
  }
  if (s.pembenihanProduction !== undefined) {
    lines.push(`Produksi Pembenihan: ${Number(s.pembenihanProduction).toLocaleString('id-ID')} Ekor`);
  }
  if (s.totalRtp !== undefined) lines.push(`Total RTP: ${Number(s.totalRtp).toLocaleString('id-ID')}`);
  if (s.totalFarmer !== undefined) lines.push(`Total Pembudidaya: ${Number(s.totalFarmer).toLocaleString('id-ID')}`);
  if (s.totalGroup !== undefined) lines.push(`Total Kelompok: ${Number(s.totalGroup).toLocaleString('id-ID')}`);
  if (s.totalKusuka !== undefined) lines.push(`Total KUSUKA: ${Number(s.totalKusuka).toLocaleString('id-ID')}`);

  // Production by fish type (compact)
  if (s.productionByFishType && typeof s.productionByFishType === 'object') {
    const fishData = s.productionByFishType as Record<string, number>;
    lines.push('Per jenis ikan: ' + Object.entries(fishData)
      .map(([k, v]) => `${k}: ${Number(v).toLocaleString('id-ID')}`)
      .join(', '));
  }

  // Production by kecamatan (compact)
  if (s.productionByKecamatan && typeof s.productionByKecamatan === 'object') {
    const kecData = s.productionByKecamatan as Record<string, number>;
    lines.push('Per kecamatan: ' + Object.entries(kecData)
      .sort(([,a],[,b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${Number(v).toLocaleString('id-ID')}`)
      .join(', '));
  }

  // 5-year trend (compact)
  if (s.trend5Year && Array.isArray(s.trend5Year)) {
    const trend = s.trend5Year as Array<Record<string, unknown>>;
    if (trend.length > 0) {
      lines.push('Tren 5 tahun: ' + trend.map((t: Record<string, unknown>) =>
        `${t.year}: ${Number(t.pembesaranProduction || 0).toLocaleString('id-ID')}Kg`
      ).join(', '));
    }
  }

  // Target vs realisasi (compact)
  if (s.targetVsRealisasiPembesaran && typeof s.targetVsRealisasiPembesaran === 'object') {
    const targets = s.targetVsRealisasiPembesaran as Record<string, unknown>;
    const targetLines = Object.entries(targets).slice(0, 5).map(([k, v]) => {
      const d = v as Record<string, unknown>;
      return `${k}: target=${Number(d.target || 0).toLocaleString('id-ID')} realisasi=${Number(d.realisasi || 0).toLocaleString('id-ID')}`;
    });
    if (targetLines.length > 0) {
      lines.push('Target vs Realisasi: ' + targetLines.join('; '));
    }
  }

  // Active filters
  if (s.activeFilters && typeof s.activeFilters === 'object') {
    const af = s.activeFilters as Record<string, unknown>;
    const filterStr = Object.entries(af)
      .filter(([, v]) => v && v !== 'Semua tahun' && v !== 'Semua kecamatan' && v !== 'Semua desa' && v !== 'Semua jenis ikan' && v !== 'Semua wadah' && v !== 'Semua jenis usaha')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    if (filterStr) lines.push(`Filter aktif: ${filterStr}`);
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      messages = [],
      statsContext,
      filters,
    } = body as {
      message?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      statsContext?: Record<string, unknown>;
      filters?: {
        years: string[];
        kecamatan: string[];
        desa: string[];
        fishType: string[];
        containerType: string[];
        businessType: string[];
      };
      sessionId?: string;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get session ID for memory persistence (default to 'default')
    const sessionId = body.sessionId || 'default';

    // Handle memory clear command
    if (/^(hapus|bersihkan|reset)\s*(semua)?\s*(memori|ingatan|memories)/i.test(message)) {
      const count = await clearMemories(sessionId);
      return NextResponse.json({
        success: true,
        response: `✅ ${count} memori telah dihapus. Saya akan memulai dari awal lagi.`,
        model: 'system',
        provider: 'memory',
      });
    }

    // Classify question type for smart context
    const questionType = classifyQuestion(message);
    const searchTerms = extractSearchTerms(message);

    // ============================================================
    // QUESTION CONTEXT AWARENESS: Parse the user's question to
    // extract contextual info (years, kecamatan, fish type, etc.)
    // This overrides UI filters so the AI fetches the right data
    // regardless of what the UI currently shows.
    // ============================================================
    const questionCtx = await parseQuestionContext(message);
    const defaultFilters = {
      years: [], kecamatan: [], desa: [], fishType: [],
      containerType: [], businessType: [],
    };
    const resolvedFilters = await resolveEffectiveFilters(questionCtx, filters || defaultFilters);

    // If question context detected a comparison but classifyQuestion didn't catch it,
    // upgrade the question type to 'comparison'
    const effectiveQuestionType: 'specific' | 'stats' | 'general' | 'comparison' =
      (questionCtx.isComparison && questionType !== 'specific') ? 'comparison' : questionType;

    // Build context header to let the AI know what scope was auto-detected
    const contextHeader = buildContextHeader(questionCtx);

    // Add available years info so AI knows what data exists in the database
    const availableYears = await getAvailableYears();
    const availableYearsInfo = availableYears.length > 0
      ? `\n\nTahun data tersedia di database: ${availableYears.join(', ')}`
      : '';

    // ============================================================
    // Build system prompt — SMART context loading based on question type
    // ============================================================
    const MAX_PROMPT_CHARS = 25000; // ~6,000 tokens — safe for Groq API limits
    const TRUNCATION_NOTE = '\n\n[Data dipangkas karena terlalu panjang. Untuk detail lengkap, tanya secara spesifik.]';

    // Base prompt + memory (always included)
    let systemPrompt = BASE_SYSTEM_PROMPT + availableYearsInfo;

    // Add question context header if any context was auto-detected
    if (contextHeader) {
      systemPrompt += '\n\n' + contextHeader;
    }

    // 🧠 MEMORY: Retrieve relevant memories and inject into system prompt
    const memories = await retrieveMemories(sessionId, message);
    const memoryContext = formatMemoriesForPrompt(memories);
    if (memoryContext) {
      systemPrompt += memoryContext;
    }

    // SMART DATA CONTEXT LOADING:
    // - 'general': Only compact summaries (~500 chars) — keeps prompt tiny
    // - 'stats': Summary + business type breakdown + kecamatan list (~2K chars)
    // - 'specific': Full data context + targeted results — largest, but still limited
    // - 'comparison': Multi-year comparison context
    let totalGroups = 0;
    if (effectiveQuestionType === 'comparison') {
      // For comparison questions, load multi-year comparison context
      const comparisonContext = await fetchMultiYearComparisonContext(resolvedFilters);
      systemPrompt += comparisonContext;
      // Also add KUSUKA data for context
      const kusukaContext = await fetchKusukaDataContext();
      systemPrompt += kusukaContext;
      totalGroups = 0; // comparison spans multiple years
    } else if (effectiveQuestionType === 'general') {
      // For general/greeting questions, only include compact summary stats
      // Use resolved year from question context if available
      const resolvedYear = resolvedFilters.years.length > 0
        ? parseInt(resolvedFilters.years[0], 10)
        : undefined;
      const compactContext = await fetchCompactDataContext(resolvedYear);
      systemPrompt += compactContext.dataContext;
      totalGroups = compactContext.totalGroups;
    } else if (effectiveQuestionType === 'stats') {
      // For stats/counting questions, include summaries + business breakdown
      // but NOT the full group list (which is 10K+ chars and causes Groq 413 errors)
      // Use resolved filters (which may override years/kecamatan from question)
      const statsResult = await fetchStatsDataContext(resolvedFilters);
      systemPrompt += statsResult.dataContext;
      totalGroups = statsResult.totalGroups;
    } else {
      // For specific questions, load full data context
      // Use resolved filters (which may override years/kecamatan from question)
      const fullContext = await fetchFullDataContext(resolvedFilters);
      systemPrompt += fullContext.dataContext;
      totalGroups = fullContext.totalGroups;
    }

    // Add KUSUKA data context for stats and specific questions only
    // (general/greeting questions don't need KUSUKA details, comparison already includes it)
    if (effectiveQuestionType !== 'general' && effectiveQuestionType !== 'comparison') {
      const kusukaContext = await fetchKusukaDataContext();
      systemPrompt += kusukaContext;
    }

    // Add stats context (compact) for stats/general questions
    let statsSection = '';
    if (effectiveQuestionType === 'stats' || effectiveQuestionType === 'general') {
      statsSection = buildCompactStats(statsContext);
      systemPrompt += statsSection;
    }

    // Knowledge Base context - inject summary of available documents
    const kbContext = await getKnowledgeBaseContext();
    if (kbContext) {
      systemPrompt += kbContext;
      systemPrompt += `\nKETENTUAN BASIS PENGETAHUAN: Jika pertanyaan user berkaitan dengan dokumen di Basis Pengetahuan, cari informasi di sana. Gunakan data dari Basis Pengetahuan sebagai sumber utama jika relevan.\n`;
    }

    // Search Knowledge Base for relevant content
    let kbSearchResults: string[] = [];
    try {
      kbSearchResults = await searchKnowledgeBase(message, 3);
      if (kbSearchResults.length > 0) {
        const kbContent = `\n\n=== DATA RELEVAN DARI BASIS PENGETAHUAN ===\n${kbSearchResults.join("\n\n---\n\n")}\n=== AKHIR DATA BASIS PENGETAHUAN ===\n`;
        systemPrompt += kbContent;
      }
    } catch (e) {
      console.error("KB search error:", e);
    }

    // Add targeted results for specific questions (group/farmer details with member names)
    // These are the VERBOSE parts that can blow past token limits
    let targetedResults = '';
    let kusukaTargetedResults = '';
    if (effectiveQuestionType === 'specific' || searchTerms.length > 0) {
      // Pass resolved filters so targeted results also use question-aware year/kecamatan
      targetedResults = await fetchTargetedResults(searchTerms, effectiveQuestionType, resolvedFilters);
      kusukaTargetedResults = await fetchKusukaTargetedResults(searchTerms, effectiveQuestionType);
    }

    // ============================================================
    // PROMPT SIZE LIMIT ENFORCEMENT
    // If the prompt exceeds MAX_PROMPT_CHARS, strategically remove
    // the most verbose parts to stay within limits.
    // Priority: keep summaries, remove individual details.
    // ============================================================
    let wasTruncated = false;
    const promptBeforeTargeted = systemPrompt.length;

    // Try adding KUSUKA targeted results first (usually smaller)
    if (kusukaTargetedResults) {
      const sizeAfterKusukaTargeted = promptBeforeTargeted + kusukaTargetedResults.length + targetedResults.length;
      if (sizeAfterKusukaTargeted <= MAX_PROMPT_CHARS) {
        // Both fit — add both
        systemPrompt += kusukaTargetedResults;
        systemPrompt += targetedResults;
      } else {
        // Check if KUSUKA targeted alone fits
        const sizeWithKusukaOnly = promptBeforeTargeted + kusukaTargetedResults.length;
        if (sizeWithKusukaOnly <= MAX_PROMPT_CHARS) {
          systemPrompt += kusukaTargetedResults;
          // Try to fit targeted results too (truncated if needed)
          const remainingBudget = MAX_PROMPT_CHARS - systemPrompt.length - TRUNCATION_NOTE.length;
          if (targetedResults && remainingBudget > 200) {
            systemPrompt += targetedResults.substring(0, remainingBudget);
            wasTruncated = true;
          } else if (targetedResults) {
            wasTruncated = true;
          }
        } else {
          // KUSUKA targeted doesn't fit — skip it, try regular targeted
          const remainingBudget = MAX_PROMPT_CHARS - promptBeforeTargeted - TRUNCATION_NOTE.length;
          if (targetedResults && remainingBudget > 200) {
            systemPrompt += targetedResults.substring(0, remainingBudget);
            wasTruncated = true;
          } else {
            wasTruncated = true;
          }
        }
      }
    } else if (targetedResults) {
      // No KUSUKA targeted, just regular targeted
      const sizeWithTargeted = promptBeforeTargeted + targetedResults.length;
      if (sizeWithTargeted <= MAX_PROMPT_CHARS) {
        systemPrompt += targetedResults;
      } else {
        const remainingBudget = MAX_PROMPT_CHARS - promptBeforeTargeted - TRUNCATION_NOTE.length;
        if (remainingBudget > 200) {
          systemPrompt += targetedResults.substring(0, remainingBudget);
        }
        wasTruncated = true;
      }
    }

    if (wasTruncated) {
      systemPrompt += TRUNCATION_NOTE;
    }

    // Log prompt size for debugging
    const promptChars = systemPrompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);
    const memoryCount = memories.length;
    const targetedChars = targetedResults.length;
    const kusukaTargetedChars = kusukaTargetedResults.length;
    console.log(`AI Chat: questionType=${effectiveQuestionType}, promptChars=${promptChars}, estTokens=${estimatedTokens}, searchTerms=${searchTerms.join(',')}, totalGroups=${totalGroups}, memories=${memoryCount}, targetedChars=${targetedChars}, kusukaTargetedChars=${kusukaTargetedChars}, truncated=${wasTruncated}, resolvedYears=${resolvedFilters.years.join(',')}, resolvedKec=${resolvedFilters.kecamatan.join(',')}, questionCtxYears=${questionCtx.years.join(',')}`);

    // Build conversation messages
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(Array.isArray(messages)
        ? messages.slice(-6).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: String(m.content),
          }))
        : []),
      { role: 'user' as const, content: message },
    ];

    // Call AI (Gemini primary → Groq fallback → z-ai last resort)
    // Use higher max_tokens for listing questions to avoid truncated responses
    const isListingQuestion = /semua|seluruh|daftar|tampilkan|sebutkan/i.test(message);
    const maxTokens = isListingQuestion ? 4096 : 2048;

    const result = await callAI({
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: maxTokens,
    });

    if (!result.success) {
      console.error('AI Chat error:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Gagal memproses pesan AI',
          detail: result.error,
        },
        { status: 500 }
      );
    }

    // 🧠 MEMORY: Extract and store memories from this conversation
    // Run asynchronously — don't block the response
    const aiResponse = result.content || 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.';
    const recentMsgs = (Array.isArray(messages) ? messages : []) as Array<{ role: 'user' | 'assistant'; content: string }>;

    // Extract memories (fire-and-forget)
    const extractedMemories = extractMemoriesFromConversation(
      sessionId, message, aiResponse, recentMsgs
    );
    if (extractedMemories.length > 0) {
      storeMemories(sessionId, extractedMemories).catch(err => {
        console.error('[AI Chat] Memory store error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      model: result.model,
      provider: result.provider,
      memoriesExtracted: extractedMemories.length,
      memoriesUsed: memoryCount,
    });
  } catch (error: unknown) {
    console.error('AI Chat error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal memproses pesan AI',
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic';
