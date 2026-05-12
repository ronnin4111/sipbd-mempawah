import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

/**
 * Compact system prompt for SIPBD AI assistant.
 * Option B: Flexible — prioritize fishery, but can answer general questions.
 *
 * OPTIMIZED: Keep prompt under ~4000 tokens to stay within Gemini free tier limits.
 * Strategy: Only include relevant data based on the user's question type.
 * - General questions → summary stats only
 * - Specific group/farmer → targeted search results
 * - Production/trend → stats context
 */
const BASE_SYSTEM_PROMPT = `Anda adalah Asisten AI Perikanan Budidaya (SIPBD AI), asisten ahli Dinas Pertanian Ketahanan Pangan dan Perikanan Kabupaten Mempawah, Kalimantan Barat.

Peran utama:
- Menjawab pertanyaan tentang data produksi perikanan budidaya di Kab. Mempawah
- Menganalisis tren, membandingkan kecamatan, memberikan rekomendasi
- Mencari data kelompok/pembudidaya spesifik dari konteks yang disediakan

Anda juga fleksibel:
- Pertanyaan umum tentang budidaya ikan, akuakultur, dll → jawab dengan pengetahuan Anda
- Pertanyaan di luar topik → jawab singkat, arahkan kembali ke perikanan budidaya 😊

Aturan respons:
- WAJIB bahasa Indonesia
- Angka format Indonesia (1.234.567 kg, Rp 25.000)
- JANGAN mengarang angka — jika data tidak tersedia, katakan jujur
- Jika nama kelompok/pembudidaya tidak ditemukan, sarankan nama mirip

Pengetahuan domain:
- 9 kecamatan: Siantan, Sengah Temila, Mempawah Hilir, Mempawah Hulu, Ledo, Toho, Mandor, Sungai Kunyit, Jawai
- Jenis usaha: Pembesaran (Kg) & Pembenihan (Ekor)
- Jenis ikan: Mas, Nila, Lele, Patin, Jelawat, Bawal Air Tawar, Gurame, Vaname, Lainnya
- Wadah: KJA, Kolam Air Tenang, Tambak, Bioflok, KJT, Bak Semen, Bak Terpal, Kolam, Kolam Terpal, Keramba, Sawah
- RTP=Rumah Tangga Perikanan, KUSUKA=Kartu Identitas Usaha Perikanan, CPIB=Cara Pembenihan Ikan Baik, CBIB=Cara Budidaya Ikan Baik
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
    /grup\s+\w+/i,
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
 * Fetch targeted search results — compact format to save tokens.
 * Only called when user asks about specific group/farmer.
 */
async function fetchTargetedResults(searchTerms: string[]): Promise<string> {
  if (searchTerms.length === 0) return '';

  try {
    const where: Record<string, unknown> = {};
    where.year = new Date().getFullYear();

    const records = await db.fishFarm.findMany({ where });

    const groupMap = new Map<string, {
      name: string; kecamatan: string; desa: string;
      fishTypes: Set<string>; memberCount: number; rtpCount: number;
    }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kecamatan: r.kecamatan, desa: r.desa,
          fishTypes: new Set(), memberCount: 0, rtpCount: 0,
        });
      }
      groupMap.get(key)!.fishTypes.add(r.fishType);

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
        let mc = 0, rc = 0, kc = 0;
        for (const r of farmerMap.values()) {
          mc += r.farmerCount;
          rc += r.rtpCount;
          if (/^\d{16}$/.test(String(r.kusuka || '').trim())) kc++;
        }
        group.memberCount = mc;
        group.rtpCount = rc;
      }
    }

    // Search for matching groups — COMPACT FORMAT
    const foundGroups: string[] = [];
    const foundFarmers: string[] = [];
    const matchedGroupKeys = new Set<string>();

    for (const term of searchTerms) {
      const q = term.toLowerCase();

      for (const [key, group] of groupMap) {
        if (
          group.name.toLowerCase().includes(q) ||
          group.kecamatan.toLowerCase().includes(q) ||
          group.desa.toLowerCase().includes(q)
        ) {
          if (matchedGroupKeys.has(key)) continue;
          matchedGroupKeys.add(key);

          // Get members of this group
          const groupFarmers = farmerLatestByGroup.get(key);
          const memberNames: string[] = [];
          if (groupFarmers) {
            for (const r of groupFarmers.values()) {
              memberNames.push(`${r.farmerName} (${r.fishType}/${r.businessType})`);
            }
          }

          foundGroups.push(
            `Kelompok: ${group.name} | Kec: ${group.kecamatan} | Desa: ${group.desa} | Anggota: ${group.memberCount} | RTP: ${group.rtpCount} | Ikan: ${[...group.fishTypes].join(',')}\n  Anggota: ${memberNames.join('; ')}`
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
      result += '\nPembudidaya ditemukan:\n' + foundFarmers.slice(0, 20).join('\n');
    }
    return result;
  } catch (error) {
    console.error('Failed to fetch targeted results:', error);
    return '';
  }
}

/**
 * Fetch compact data context — only include summary stats and group name list.
 * No farmer details unless specifically asked (handled by targetedResults).
 */
async function fetchCompactDataContext(filters: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<string> {
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
      return '\n=== DATA ===\nTidak ada data untuk filter yang dipilih.';
    }

    // Build compact group list
    const groupMap = new Map<string, { name: string; kec: string; desa: string; anggota: number; rtp: number; fishTypes: Set<string> }>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName?.trim()) return;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: r.groupName.trim(), kec: r.kecamatan, desa: r.desa,
          anggota: 0, rtp: 0, fishTypes: new Set(),
        });
      }
      groupMap.get(key)!.fishTypes.add(r.fishType);

      if (!farmerLatestByGroup.has(key)) farmerLatestByGroup.set(key, new Map());
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!farmerLatestByGroup.get(key)!.has(fid)) {
        farmerLatestByGroup.get(key)!.set(fid, r);
      }
    });

    for (const [key, group] of groupMap) {
      const farmerMap = farmerLatestByGroup.get(key);
      if (farmerMap) {
        let mc = 0, rc = 0, kc = 0;
        for (const r of farmerMap.values()) {
          mc += r.farmerCount;
          rc += r.rtpCount;
          if (/^\d{16}$/.test(String(r.kusuka || '').trim())) kc++;
        }
        group.anggota = mc;
        group.rtp = rc;
      }
    }

    // Compact format: one line per group
    const groupLines = Array.from(groupMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30) // Limit to 30 groups to save tokens
      .map(g => `${g.name} (${g.kec}/${g.desa}) ${g.anggota}org ${g.rtp}rtp [${[...g.fishTypes].join(',')}]`);

    const kecList = [...new Set(records.map(r => r.kecamatan))].sort();
    const totalGroups = groupMap.size;

    return `\n=== DATA CONTEXT ===
Total kelompok: ${totalGroups} (menampilkan ${Math.min(30, totalGroups)})
Kecamatan: ${kecList.join(', ')}
Daftar kelompok (nama | kec/desa | anggota | rtp | ikan):
${groupLines.join('\n')}`;
  } catch (error) {
    console.error('Failed to fetch data context:', error);
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

    // Add stats context (compact) for stats/general questions
    if (questionType === 'stats' || questionType === 'general') {
      systemPrompt += buildCompactStats(statsContext);
    }

    // Always add compact data context for data-aware answers
    if (questionType !== 'general') {
      const dataContext = await fetchCompactDataContext(filters || {
        years: [], kecamatan: [], desa: [], fishType: [],
        containerType: [], businessType: [],
      });
      systemPrompt += dataContext;
    }

    // Add targeted results for specific questions
    if (questionType === 'specific' || searchTerms.length > 0) {
      const targeted = await fetchTargetedResults(searchTerms);
      if (targeted) systemPrompt += targeted;
    }

    // Log prompt size for debugging
    const promptChars = systemPrompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);
    console.log(`AI Chat: questionType=${questionType}, promptChars=${promptChars}, estTokens=${estimatedTokens}, searchTerms=${searchTerms.join(',')}`);

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

    // Call AI (Gemini primary, z-ai fallback)
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
