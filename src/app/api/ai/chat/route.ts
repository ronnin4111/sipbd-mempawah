import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

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

Anda juga fleksibel:
- Pertanyaan umum tentang budidaya ikan, akuakultur, dll → jawab dengan pengetahuan Anda
- Pertanyaan di luar topik → jawab singkat, arahkan kembali ke perikanan budidaya 😊

Aturan respons SANGAT PENTING:
- WAJIB bahasa Indonesia
- Angka format Indonesia (1.234.567 kg, Rp 25.000)
- ⚠️ JANGAN MENGARANG DATA — HANYA gunakan data yang ada di DATA CONTEXT
- ⚠️ JANGAN menyebutkan nama kecamatan/kelompok/ikan yang TIDAK ada di DATA CONTEXT
- Jika data tidak tersedia di konteks, katakan jujur "Data tidak tersedia"
- Jika nama kelompok/pembudidaya tidak ditemukan, sarankan nama mirip dari DATA CONTEXT
- Daftar kelompok/kecamatan/desa HANYA dari data yang disediakan — JANGAN tebak

Istilah:
- RTP=Rumah Tangga Perikanan, KUSUKA=Kartu Identitas Usaha Perikanan
- CPIB=Cara Pembenihan Ikan Baik, CBIB=Cara Budidaya Ikan Baik
- Kelompok=poktan/pokdakan (kelompok pembudidaya ikan), Anggota=jumlah anggota kelompok`;

/**
 * Classify the user's question type to determine what data to include.
 */
function classifyQuestion(message: string): 'specific' | 'stats' | 'general' {
  const lower = message.toLowerCase();

  // Specific group/farmer questions
  const specificPatterns = [
    /kelompok\s+\w+/i, /anggota\s+kelompok/i, /pembudidaya\s+\w+/i,
    /siapa\s+saja/i, /daftar\s+anggota/i, /nama\s+kelompok/i,
    /grup\s+\w+/i, /semua\s+kelompok/i, /seluruh\s+kelompok/i,
    /tampilkan\s+semua/i, /tampilkan\s+seluruh/i, /daftar\s+kelompok/i,
    /berapa\s+kelompok/i, /berapa\s+jumlah\s+kelompok/i,
  ];
  if (specificPatterns.some(p => p.test(lower))) return 'specific';

  // Stats/production/trend questions
  const statsPatterns = [
    /produksi/i, /tren/i, /statistik/i, /total/i, /jumlah/i,
    /kecamatan.*tinggi/i, /kecamatan.*rendah/i, /perbandingan/i,
    /rtp/i, /kusuka/i, /cpib/i, /cbib/i, /pencapaian/i, /target/i,
    /naik/i, /turun/i, /kenaikan/i, /penurunan/i, /pertumbuhan/i,
  ];
  if (statsPatterns.some(p => p.test(lower))) return 'stats';

  return 'general';
}

/**
 * Extract potential search keywords from the user's message.
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  const patterns = [
    /kelompok\s+([^\?,\.\!]+)/i,
    /anggota\s+kelompok\s+([^\?,\.\!]+)/i,
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
}> {
  try {
    const where: Record<string, unknown> = {};

    if (filters.years.length > 0) {
      where.year = { in: filters.years.map(Number).filter(n => !isNaN(n)) };
    } else {
      where.year = new Date().getFullYear();
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
      };
    }

    // Build comprehensive group data
    const groupMap = new Map<string, {
      name: string; kec: string; desa: string;
      fishTypes: Set<string>; businessTypes: Set<string>;
      memberCount: number; rtpCount: number; kusukaCount: number;
    }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    // Also build all-farmer latest map for total farmer count
    const allFarmerLatest = new Map<string, typeof records[0]>();

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kec: r.kecamatan, desa: r.desa,
          fishTypes: new Set(), businessTypes: new Set(),
          memberCount: 0, rtpCount: 0, kusukaCount: 0,
        });
      }
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

    // Build COMPLETE group list — one line per group (compact format)
    const sortedGroups = Array.from(groupMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    const groupLines = sortedGroups.map(g =>
      `${g.name} (${g.kec}/${g.desa}) ${g.memberCount}org ${g.rtpCount}rtp ${g.kusukaCount}kusuka [${[...g.fishTypes].join(',')}]`
    );

    const totalGroups = groupMap.size;
    const totalFarmers = allFarmerLatest.size;

    // Build kecamatan → desa mapping
    const kecDesaLines: string[] = [];
    for (const [kec, desas] of desaByKec) {
      kecDesaLines.push(`${kec}: ${[...desas].sort().join(', ')}`);
    }

    const dataContext = `\n=== DATA CONTEXT (WAJIB: gunakan HANYA data ini, jangan mengarang) ===
Total kelompok: ${totalGroups}
Total pembudidaya: ${totalFarmers}
Kecamatan (${kecList.length}): ${kecList.join(', ')}
Desa per kecamatan:
${kecDesaLines.join('\n')}
Jenis ikan: ${fishTypeList.join(', ')}
Jenis usaha: ${businessTypeList.join(', ')}
Wadah budidaya: ${containerTypeList.join(', ')}

DAFTAR KELOMPOK LENGKAP (${totalGroups} kelompok — nama | kec/desa | anggota | rtp | kusuka | ikan):
${groupLines.join('\n')}`;

    return { dataContext, kecamatanList: kecList, totalGroups, totalFarmers };
  } catch (error) {
    console.error('Failed to fetch data context:', error);
    return {
      dataContext: '\n=== DATA ===\nGagal memuat data. Jawab berdasarkan pengetahuan umum saja.',
      kecamatanList: [],
      totalGroups: 0,
      totalFarmers: 0,
    };
  }
}

/**
 * Fetch targeted search results with FULL member details.
 * Returns all matching groups and their members.
 */
async function fetchTargetedResults(searchTerms: string[]): Promise<string> {
  if (searchTerms.length === 0) return '';

  try {
    const where: Record<string, unknown> = {};
    where.year = new Date().getFullYear();

    const records = await db.fishFarm.findMany({ where });

    const groupMap = new Map<string, {
      name: string; kecamatan: string; desa: string;
      fishTypes: Set<string>; businessTypes: Set<string>;
      memberCount: number; rtpCount: number;
    }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kecamatan: r.kecamatan, desa: r.desa,
          fishTypes: new Set(), businessTypes: new Set(),
          memberCount: 0, rtpCount: 0,
        });
      }
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
          group.desa.toLowerCase().includes(q) ||
          [...group.fishTypes].some(f => f.toLowerCase().includes(q))
        ) {
          if (matchedGroupKeys.has(key)) continue;
          matchedGroupKeys.add(key);

          // Get ALL members of this group
          const groupFarmers = farmerLatestByGroup.get(key);
          const memberNames: string[] = [];
          if (groupFarmers) {
            for (const r of groupFarmers.values()) {
              memberNames.push(`${r.farmerName} (${r.fishType}/${r.businessType})`);
            }
          }

          foundGroups.push(
            `Kelompok: ${group.name} | Kec: ${group.kecamatan} | Desa: ${group.desa} | Anggota: ${group.memberCount} | RTP: ${group.rtpCount} | Ikan: ${[...group.fishTypes].join(',')} | Usaha: ${[...group.businessTypes].join(',')}\n  Daftar anggota: ${memberNames.join('; ')}`
          );
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
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Classify question type for smart context
    const questionType = classifyQuestion(message);
    const searchTerms = extractSearchTerms(message);

    // Build system prompt based on question type
    let systemPrompt = BASE_SYSTEM_PROMPT;

    // ALWAYS add full data context — AI needs accurate data for ALL question types
    const { dataContext, totalGroups } = await fetchFullDataContext(filters || {
      years: [], kecamatan: [], desa: [], fishType: [],
      containerType: [], businessType: [],
    });
    systemPrompt += dataContext;

    // Add stats context (compact) for stats/general questions
    if (questionType === 'stats' || questionType === 'general') {
      systemPrompt += buildCompactStats(statsContext);
    }

    // Add targeted results for specific questions (group/farmer details)
    if (questionType === 'specific' || searchTerms.length > 0) {
      const targeted = await fetchTargetedResults(searchTerms);
      if (targeted) systemPrompt += targeted;
    }

    // Log prompt size for debugging
    const promptChars = systemPrompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);
    console.log(`AI Chat: questionType=${questionType}, promptChars=${promptChars}, estTokens=${estimatedTokens}, searchTerms=${searchTerms.join(',')}, totalGroups=${totalGroups}`);

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
    const result = await callAI({
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 2048,
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

    return NextResponse.json({
      success: true,
      response: result.content || 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.',
      model: result.model,
      provider: result.provider,
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
