import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

// Singleton ZAI instance — reuse across requests to avoid re-initialization
let zaiInstance: InstanceType<typeof ZAI> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Build the system prompt for the SIPBD AI assistant.
 * If statsContext is provided, it is injected as structured data context
 * so the AI can answer data-specific questions about fishery production.
 */
function buildSystemPrompt(
  statsContext?: Record<string, unknown>,
  dataContext?: Record<string, unknown>
): string {
  let prompt = `You are Asisten AI Perikanan Budidaya (SIPBD AI), an expert assistant for the Dinas Pertanian Ketahanan Pangan dan Perikanan Kabupaten Mempawah, Kalimantan Barat.

Your role:
- Answer questions about fish farming (perikanan budidaya) production data in Kabupaten Mempawah
- Analyze trends, compare kecamatan, identify issues, and provide recommendations
- Respond in Bahasa Indonesia
- Be concise but informative
- Format large numbers with thousand separators using Indonesian format (e.g., 1.234.567 kg, Rp 25.000)
- When you see declining trends or underperforming areas, suggest potential actions
- If data is not available in the provided context, say so honestly and do not fabricate numbers
- When comparing data, highlight both positive and negative findings
- Suggest relevant actions when identifying issues (e.g., low production areas, declining trends, missing KUSUKA registrations)
- Use proper Indonesian terminology for fisheries terms
- When asked about a specific group (kelompok) or farmer (pembudidaya), search the provided groups/farmers data
- If a group or farmer name is not found, suggest similar names that exist in the data

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
- Always answer based on the provided data context. Do NOT fabricate or guess numbers.
- If asked about a specific group, check the "groups" list in the data context section.
- If asked about a specific farmer, check the "farmers" list in the data context section.
- If a name is not found, try searching case-insensitively or suggest similar names.
- For group member count questions, use "memberCount" from the groups data.
- Always format numbers with Indonesian thousand separators (dot separator, e.g., 1.234.567).`;

  if (statsContext && Object.keys(statsContext).length > 0) {
    prompt += `\n\n=== STATISTIK PRODUKSI (AGREGAT) ===\nBerikut adalah data agregat produksi perikanan budidaya Kabupaten Mempawah:\n`;
    prompt += JSON.stringify(statsContext, null, 2);
  }

  if (dataContext && Object.keys(dataContext).length > 0) {
    prompt += `\n\n=== DATA KELOMPOK DAN PEMBUDIDAYA (DETAIL) ===\nBerikut adalah data detail kelompok dan pembudidaya:\n`;
    prompt += JSON.stringify(dataContext, null, 2);
    prompt += `\n\nGunakan data di atas untuk menjawab pertanyaan tentang kelompok spesifik, jumlah anggota, pembudidaya, dan lokasi.`;
  }

  return prompt;
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
  search?: string;
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
    let groups = Array.from(groupMap.values()).map(g => ({
      namaKelompok: g.name,
      kecamatan: g.kecamatan,
      desa: g.desa,
      jenisUsaha: Array.from(g.businessTypes),
      jenisIkan: Array.from(g.fishTypes),
      jumlahAnggota: g.memberCount,
      jumlahRTP: g.rtpCount,
      jumlahKUSUKA: g.kusukaCount,
    }));

    // Apply search filter if provided
    if (filters.search) {
      const q = filters.search.toLowerCase();
      groups = groups.filter(g =>
        g.namaKelompok.toLowerCase().includes(q) ||
        g.kecamatan.toLowerCase().includes(q) ||
        g.desa.toLowerCase().includes(q)
      );
    }

    groups.sort((a, b) => a.namaKelompok.localeCompare(b.namaKelompok));
    // Limit to prevent context from being too large
    const totalGroups = groups.length;
    const limitedGroups = groups.slice(0, 80);

    // === Farmer Summary ===
    const allFarmerLatest = new Map<string, typeof records[0]>();
    for (const r of sortedDesc) {
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '', groupName: r.groupName || '',
        kecamatan: r.kecamatan || '', desa: r.desa || '',
      });
      if (!allFarmerLatest.has(fid)) allFarmerLatest.set(fid, r);
    }

    let farmers = Array.from(allFarmerLatest.values()).map(r => ({
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

    if (filters.search) {
      const q = filters.search.toLowerCase();
      farmers = farmers.filter(f =>
        f.namaPembudidaya.toLowerCase().includes(q) ||
        f.namaKelompok.toLowerCase().includes(q) ||
        f.kecamatan.toLowerCase().includes(q)
      );
    }

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

    const zai = await getZAI();

    // Fetch data context from database (server-side, no HTTP overhead)
    const dataContext = await fetchDataContext(filters || {
      years: [], kecamatan: [], desa: [], fishType: [],
      containerType: [], businessType: [],
    });

    const systemPrompt = buildSystemPrompt(statsContext, dataContext);

    // Build conversation messages:
    // 1. System prompt with stats context + data context
    // 2. Up to last 10 messages from conversation history for context window
    // 3. The user's new message
    const chatMessages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(messages)
        ? messages.slice(-10).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: String(m.content),
          }))
        : []),
      { role: 'user', content: message },
    ];

    const completion = await zai.chat.completions.create({
      messages: chatMessages,
    });

    const aiResponse =
      completion.choices[0]?.message?.content ||
      'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini. Silakan coba lagi.';

    return NextResponse.json({
      success: true,
      response: aiResponse,
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
