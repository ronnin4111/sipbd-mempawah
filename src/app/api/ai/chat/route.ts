import { NextRequest, NextResponse } from 'next/server';
import { hfChatCompletion, isHfConfigured } from '@/lib/hf-ai';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

/**
 * Build the system prompt for the SIPBD AI assistant.
 * Option B: Flexible — prioritize fishery, but can answer general questions.
 */
function buildSystemPrompt(
  statsContext?: Record<string, unknown>,
  dataContext?: Record<string, unknown>,
  targetedResults?: Record<string, unknown>
): string {
  let prompt = `You are Asisten AI Perikanan Budidaya (SIPBD AI), an expert assistant for the Dinas Pertanian Ketahanan Pangan dan Perikanan Kabupaten Mempawah, Kalimantan Barat.

Your primary role:
- Answer questions about fish farming (perikanan budidaya) production data in Kabupaten Mempawah
- Analyze trends, compare kecamatan, identify issues, and provide recommendations
- When asked about a specific group (kelompok) or farmer (pembudidaya), search the provided groups/farmers data

You are also flexible and helpful:
- If asked general questions about fish farming techniques, aquaculture, fish species, water management, etc. — answer helpfully using your knowledge
- If asked about agriculture, food security, or related government programs — answer helpfully
- If asked about completely unrelated topics (weather, math, general knowledge) — you may answer briefly and politely, then gently redirect: "Untuk pertanyaan lebih lanjut tentang perikanan budidaya di Kab. Mempawah, saya siap membantu! 😊"

Response rules:
- Respond in Bahasa Indonesia
- Be concise but informative
- Format large numbers with thousand separators using Indonesian format (e.g., 1.234.567 kg, Rp 25.000)
- When you see declining trends or underperforming areas, suggest potential actions
- If data is not available in the provided context, say so honestly and do not fabricate numbers
- When comparing data, highlight both positive and negative findings
- Suggest relevant actions when identifying issues
- Use proper Indonesian terminology for fisheries terms
- If a group or farmer name is not found, suggest similar names that exist in the data
- When asked "siapa saja" or "daftar anggota" for a group, list ALL farmer names from the "HASIL PENCARIAN SPESIFIK" section if available

Key domain knowledge:
- Kabupaten Mempawah has 9 kecamatan: Siantan, Sengah Temila, Mempawah Hilir, Mempawah Hulu, Ledo, Toho, Mandor, Sungai Kunyit, Jawai
- Business types: Pembesaran (grow-out, measured in Kg) and Pembenihan (hatchery, measured in Ekor)
- Fish types: Mas, Nila, Lele, Patin, Jelawat, Bawal Air Tawar, Gurame, Vaname, Lainnya
- Container types: KJA (Keramba Jaring Apung), Kolam Air Tenang, Tambak, Bioflok, KJT (Keramba Jaring Tancap), Bak Semen, Bak Terpal, Kolam, Kolam Terpal, Keramba, Sawah
- RTP = Rumah Tangga Perikanan (fishery households) — indicates the number of farming households
- KUSUKA = Kartu Identitas Usaha Perikanan (fishery business ID card) — indicates formal registration
- CPIB = Cara Pembenihan Ikan yang Baik (good hatchery practices certification)
- CBIB = Cara Budidaya Ikan yang Baik (good aquaculture practices certification)
- Production value is typically measured in Rp (Rupiah)
- Anggota kelompok = member count of a fish farmer group (kelompok pembudidaya)
- Kelompok = group of fish farmers working together
- Poktan/Pokdakan = Kelompok Pembudidaya Ikan (fish farmer group)

When analyzing data:
1. Identify the top and bottom performing kecamatan
2. Note any year-over-year trends (growth or decline)
3. Compare production volumes across fish types
4. Assess RTP distribution and KUSUKA registration rates
5. Recommend actions for improvement where needed

IMPORTANT RULES:
- Always answer based on the provided data context when data questions are asked. Do NOT fabricate or guess numbers.
- If asked about a specific group, check the "daftarKelompok" in the data context, AND check the "HASIL PENCARIAN SPESIFIK" section for detailed member list.
- If asked about a specific farmer, check the "daftarPembudidaya" in the data context AND the "HASIL PENCARIAN SPESIFIK" section.
- If a name is not found, try searching case-insensitively or suggest similar names.
- For group member count questions, use "jumlahAnggota" from the groups data.
- For "siapa saja anggota" questions, list the farmer names from the targeted search results.
- Always format numbers with Indonesian thousand separators (dot separator, e.g., 1.234.567).`;

  if (statsContext && Object.keys(statsContext).length > 0) {
    prompt += `\n\n=== STATISTIK PRODUKSI (AGREGAT) ===\nBerikut adalah data agregat produksi perikanan budidaya Kabupaten Mempawah:\n`;
    prompt += JSON.stringify(statsContext, null, 2);
  }

  if (dataContext && Object.keys(dataContext).length > 0) {
    prompt += `\n\n=== DATA KELOMPOK DAN PEMBUDIDAYA (UMUM) ===\nBerikut adalah data kelompok dan pembudidaya (sampel terbatas):\n`;
    prompt += JSON.stringify(dataContext, null, 2);
    prompt += `\n\nCatatan: daftarPembudidaya di atas adalah sampel terbatas. Untuk daftar lengkap anggota kelompok tertentu, lihat bagian HASIL PENCARIAN SPESIFIK di bawah.`;
  }

  if (targetedResults && Object.keys(targetedResults).length > 0) {
    prompt += `\n\n=== HASIL PENCARIAN SPESIFIK ===\nBerikut adalah hasil pencarian spesifik berdasarkan pertanyaan pengguna:\n`;
    prompt += JSON.stringify(targetedResults, null, 2);
    prompt += `\n\nGunakan data di atas sebagai sumber utama untuk menjawab pertanyaan spesifik tentang kelompok/anggota/pembudidaya.`;
  }

  return prompt;
}

/**
 * Extract potential search keywords from the user's message.
 * Detects group names, farmer names, kecamatan, desa, etc.
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];
  const lower = message.toLowerCase();

  // Common Indonesian question patterns
  const patterns = [
    // "kelompok [name]" or "kelompok [name]" patterns
    /kelompok\s+([^\?,\.\!]+)/i,
    // "anggota kelompok [name]"
    /anggota\s+kelompok\s+([^\?,\.\!]+)/i,
    // "pembudidaya [name]"
    /pembudidaya\s+([^\?,\.\!]+)/i,
    // "siapa saja" after group mention
    /kelompok\s+(\w+(?:\s+\w+)*)/i,
    // "grup [name]"
    /grup\s+([^\?,\.\!]+)/i,
    // quoted names
    /["']([^"']+)["']/,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const term = match[1].trim();
      if (term.length > 2) {
        terms.push(term);
      }
    }
  }

  // Also check for proper nouns (capitalized words that aren't common words)
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

  // Deduplicate
  return [...new Set(terms)];
}

/**
 * Fetch targeted search results based on user's message.
 * This finds specific groups, farmers, etc. matching the search terms.
 */
async function fetchTargetedResults(searchTerms: string[]): Promise<Record<string, unknown>> {
  if (searchTerms.length === 0) return {};

  try {
    const where: Record<string, unknown> = {};
    where.year = new Date().getFullYear();

    const records = await db.fishFarm.findMany({ where });

    const results: {
      kelompokDitemukan: Array<Record<string, unknown>>;
      pembudidayaDitemukan: Array<Record<string, unknown>>;
    } = {
      kelompokDitemukan: [],
      pembudidayaDitemukan: [],
    };

    // Search for matching groups and their members
    const matchedGroupKeys = new Set<string>();

    // Build group data
    interface GroupDetail {
      name: string;
      kecamatan: string;
      desa: string;
      businessTypes: Set<string>;
      fishTypes: Set<string>;
      memberCount: number;
      rtpCount: number;
      kusukaCount: number;
    }

    const groupMap = new Map<string, GroupDetail>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    records.forEach(r => {
      if (!r.groupName || !r.groupName.trim()) return;
      const normalizedName = r.groupName.trim();
      const key = `${normalizedName.toLowerCase()}|${r.kecamatan}|${r.desa}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: normalizedName,
          kecamatan: r.kecamatan,
          desa: r.desa,
          businessTypes: new Set(),
          fishTypes: new Set(),
          memberCount: 0,
          rtpCount: 0,
          kusukaCount: 0,
        });
      }

      groupMap.get(key)!.businessTypes.add(r.businessType);
      groupMap.get(key)!.fishTypes.add(r.fishType);

      // Track unique farmers per group
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
        let memberCount = 0;
        let rtpCount = 0;
        let kusukaCount = 0;
        for (const r of farmerMap.values()) {
          memberCount += r.farmerCount;
          rtpCount += r.rtpCount;
          if (/^\d{16}$/.test(String(r.kusuka || '').trim())) kusukaCount++;
        }
        group.memberCount = memberCount;
        group.rtpCount = rtpCount;
        group.kusukaCount = kusukaCount;
      }
    }

    // Search for matching groups
    for (const term of searchTerms) {
      const q = term.toLowerCase();
      for (const [key, group] of groupMap) {
        if (
          group.name.toLowerCase().includes(q) ||
          group.kecamatan.toLowerCase().includes(q) ||
          group.desa.toLowerCase().includes(q)
        ) {
          if (!matchedGroupKeys.has(key)) {
            matchedGroupKeys.add(key);

            // Get ALL farmers in this group
            const groupFarmers = farmerLatestByGroup.get(key);
            const farmerList: Array<Record<string, unknown>> = [];
            if (groupFarmers) {
              for (const r of groupFarmers.values()) {
                farmerList.push({
                  namaPembudidaya: r.farmerName,
                  jenisIkan: r.fishType,
                  jenisUsaha: r.businessType,
                  jenisWadah: r.containerType,
                  punyaKUSUKA: !!r.kusuka && /^\d{16}$/.test(String(r.kusuka || '').trim()),
                  CPIB: r.cpib,
                  CBIB: r.cbib,
                });
              }
            }

            results.kelompokDitemukan.push({
              namaKelompok: group.name,
              kecamatan: group.kecamatan,
              desa: group.desa,
              jenisUsaha: Array.from(group.businessTypes),
              jenisIkan: Array.from(group.fishTypes),
              jumlahAnggota: group.memberCount,
              jumlahRTP: group.rtpCount,
              jumlahKUSUKA: group.kusukaCount,
              daftarAnggota: farmerList.sort((a, b) =>
                String(a.namaPembudidaya).localeCompare(String(b.namaPembudidaya))
              ),
            });
          }
        }
      }

      // Search for matching farmers by name
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
          (r.farmerName && r.farmerName.toLowerCase().includes(q)) ||
          (r.kecamatan && r.kecamatan.toLowerCase().includes(q)) ||
          (r.desa && r.desa.toLowerCase().includes(q))
        ) {
          // Check if already in results
          const alreadyExists = results.pembudidayaDitemukan.some(
            f => f.namaPembudidaya === r.farmerName && f.namaKelompok === r.groupName
          );
          if (!alreadyExists) {
            results.pembudidayaDitemukan.push({
              namaPembudidaya: r.farmerName,
              namaKelompok: r.groupName,
              kecamatan: r.kecamatan,
              desa: r.desa,
              jenisIkan: r.fishType,
              jenisUsaha: r.businessType,
              jenisWadah: r.containerType,
              punyaKUSUKA: !!r.kusuka && /^\d{16}$/.test(String(r.kusuka || '').trim()),
              CPIB: r.cpib,
              CBIB: r.cbib,
            });
          }
        }
      }
    }

    // If no targeted results found but we have search terms, return empty with note
    if (results.kelompokDitemukan.length === 0 && results.pembudidayaDitemukan.length === 0) {
      return {
        catatan: `Tidak ditemukan data yang cocok untuk pencarian: "${searchTerms.join(', ')}"`,
        saran: 'Coba gunakan nama yang lebih spesifik atau periksa ejaan nama kelompok/pembudidaya.',
      };
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch targeted results:', error);
    return { error: 'Gagal melakukan pencarian spesifik' };
  }
}

/**
 * Fetch data context (groups + farmers) from the database.
 * This is called server-side to avoid an extra HTTP request.
 */
async function fetchDataContext(filters: {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
}): Promise<Record<string, unknown>> {
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

    // === Group Summary ===
    interface GroupInfo {
      name: string;
      kecamatan: string;
      desa: string;
      businessTypes: Set<string>;
      fishTypes: Set<string>;
      memberCount: number;
      rtpCount: number;
      kusukaCount: number;
    }

    const groupMap = new Map<string, GroupInfo>();
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();

    records.forEach(r => {
      if (!r.groupName || !r.groupName.trim()) return;
      const normalizedName = r.groupName.trim();
      const key = `${normalizedName.toLowerCase()}|${r.kecamatan}|${r.desa}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: normalizedName,
          kecamatan: r.kecamatan,
          desa: r.desa,
          businessTypes: new Set(),
          fishTypes: new Set(),
          memberCount: 0,
          rtpCount: 0,
          kusukaCount: 0,
        });
      }

      groupMap.get(key)!.businessTypes.add(r.businessType);
      groupMap.get(key)!.fishTypes.add(r.fishType);
    });

    // Calculate accurate member counts
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);
    for (const r of sortedDesc) {
      if (!r.groupName || !r.groupName.trim()) continue;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!farmerLatestByGroup.has(key)) farmerLatestByGroup.set(key, new Map());
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!farmerLatestByGroup.get(key)!.has(fid)) {
        farmerLatestByGroup.get(key)!.set(fid, r);
      }
    }

    for (const [key, group] of groupMap) {
      const farmerMap = farmerLatestByGroup.get(key);
      if (farmerMap) {
        let memberCount = 0;
        let rtpCount = 0;
        let kusukaCount = 0;
        for (const r of farmerMap.values()) {
          memberCount += r.farmerCount;
          rtpCount += r.rtpCount;
          if (/^\d{16}$/.test(String(r.kusuka || '').trim())) kusukaCount++;
        }
        group.memberCount = memberCount;
        group.rtpCount = rtpCount;
        group.kusukaCount = kusukaCount;
      }
    }

    // Convert groups
    const groups = Array.from(groupMap.values()).map(g => ({
      namaKelompok: g.name,
      kecamatan: g.kecamatan,
      desa: g.desa,
      jenisUsaha: Array.from(g.businessTypes),
      jenisIkan: Array.from(g.fishTypes),
      jumlahAnggota: g.memberCount,
      jumlahRTP: g.rtpCount,
      jumlahKUSUKA: g.kusukaCount,
    }));

    groups.sort((a, b) => a.namaKelompok.localeCompare(b.namaKelompok));
    const totalGroups = groups.length;
    const limitedGroups = groups.slice(0, 80);

    // === Farmer Summary (limited) ===
    const allFarmerLatest = new Map<string, typeof records[0]>();
    for (const r of sortedDesc) {
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!allFarmerLatest.has(fid)) allFarmerLatest.set(fid, r);
    }

    const farmers = Array.from(allFarmerLatest.values()).map(r => ({
      namaPembudidaya: r.farmerName,
      namaKelompok: r.groupName,
      kecamatan: r.kecamatan,
      desa: r.desa,
      jenisIkan: r.fishType,
      jenisUsaha: r.businessType,
      jenisWadah: r.containerType,
      punyaKUSUKA: !!r.kusuka && /^\d{16}$/.test(String(r.kusuka || '').trim()),
      CPIB: r.cpib,
      CBIB: r.cbib,
    }));

    farmers.sort((a, b) => a.namaPembudidaya.localeCompare(b.namaPembudidaya));
    const totalFarmers = farmers.length;
    const limitedFarmers = farmers.slice(0, 80);

    // === Lists ===
    const kecamatanList = [...new Set(records.map(r => r.kecamatan))].sort();
    const desaByKecamatan: Record<string, string[]> = {};
    records.forEach(r => {
      if (!desaByKecamatan[r.kecamatan]) desaByKecamatan[r.kecamatan] = [];
      if (!desaByKecamatan[r.kecamatan].includes(r.desa)) desaByKecamatan[r.kecamatan].push(r.desa);
    });
    Object.values(desaByKecamatan).forEach(arr => arr.sort());

    return {
      daftarKelompok: limitedGroups,
      totalKelompok: totalGroups,
      ditampilkanKelompok: limitedGroups.length,
      daftarPembudidaya: limitedFarmers,
      totalPembudidaya: totalFarmers,
      ditampilkanPembudidaya: limitedFarmers.length,
      daftarKecamatan: kecamatanList,
      desaPerKecamatan: desaByKecamatan,
      jenisIkanTersedia: [...new Set(records.map(r => r.fishType))].sort(),
      jenisUsahaTersedia: [...new Set(records.map(r => r.businessType))].sort(),
    };
  } catch (error) {
    console.error('Failed to fetch data context:', error);
    return { error: 'Gagal memuat data kelompok/pembudidaya' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if Hugging Face API is configured
    if (!isHfConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Layanan AI belum dikonfigurasi',
          detail: 'HF_API_KEY belum diset. Silakan tambahkan token Hugging Face API di environment variables.',
        },
        { status: 503 }
      );
    }

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

    // Extract search terms from the user's message for targeted lookup
    const searchTerms = extractSearchTerms(message);

    // Fetch general data context from database
    const dataContext = await fetchDataContext(filters || {
      years: [], kecamatan: [], desa: [], fishType: [],
      containerType: [], businessType: [],
    });

    // Fetch targeted results based on search terms (specific groups/farmers)
    const targetedResults = searchTerms.length > 0
      ? await fetchTargetedResults(searchTerms)
      : {};

    const systemPrompt = buildSystemPrompt(statsContext, dataContext, targetedResults);

    // Build conversation messages for Hugging Face API
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(Array.isArray(messages)
        ? messages.slice(-10).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: String(m.content),
          }))
        : []),
      { role: 'user' as const, content: message },
    ];

    // Call Hugging Face Inference API
    const result = await hfChatCompletion({
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    if (!result.success) {
      console.error('HF Chat error:', result.error);
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
