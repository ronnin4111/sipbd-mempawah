import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { retrieveMemories, storeMemories, extractMemoriesFromConversation, formatMemoriesForPrompt, clearMemories } from '@/lib/ai-memory';
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
- KUSUKA=Kartu Identitas Usaha Perikanan — data registrasi perorangan pembudidaya

Anda juga fleksibel:
- Pertanyaan umum tentang budidaya ikan, akuakultur, dll → jawab dengan pengetahuan Anda
- Pertanyaan di luar topik → jawab singkat, arahkan kembali ke perikanan budidaya 😊

Anda juga bisa menjawab pertanyaan tentang data registrasi KUSUKA perorangan, status kartu, dan detail alamat pembudidaya.

Aturan respons SANGAT PENTING:
- WAJIB bahasa Indonesia
- Angka format Indonesia (1.234.567 kg, Rp 25.000)
- ⚠️ JANGAN MENGARANG DATA — HANYA gunakan data yang ada di DATA CONTEXT
- ⚠️ JANGAN menyebutkan nama kecamatan/kelompok/ikan yang TIDAK ada di DATA CONTEXT
- Jika data tidak tersedia di konteks, katakan jujur "Data tidak tersedia di konteks yang diberikan"
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
  Namun jika memori bertentangan dengan DATA CONTEXT, prioritaskan DATA CONTEXT (data DB lebih akurat).`;

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
    /kelompok\s+(pembenih|pembenihan|pembesaran)/i,
    /pembenih|pembenihan|pembesaran/i,
    /nama\s+anggota/i, /anggota\s+dari/i,
    // KUSUKA-specific patterns
    /kusuka/i, /kartu\s+usaha/i, /registrasi/i, /pendaftaran/i,
    /perorangan/i, /pembenih\s+perorangan/i, /nama\s+pembudidaya/i,
    /alamat\s+pembudidaya/i,
    /status\s+kusuka/i, /draf\s+kusuka/i, /valid\s+kusuka/i,
  ];
  if (specificPatterns.some(p => p.test(lower))) return 'specific';

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
async function fetchTargetedResults(searchTerms: string[], questionType: string): Promise<string> {
  try {
    const where: Record<string, unknown> = {};
    where.year = new Date().getFullYear();

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

    // Build system prompt based on question type
    let systemPrompt = BASE_SYSTEM_PROMPT;

    // 🧠 MEMORY: Retrieve relevant memories and inject into system prompt
    const memories = await retrieveMemories(sessionId, message);
    const memoryContext = formatMemoriesForPrompt(memories);
    if (memoryContext) {
      systemPrompt += memoryContext;
    }

    // ALWAYS add full data context — AI needs accurate data for ALL question types
    const { dataContext, totalGroups } = await fetchFullDataContext(filters || {
      years: [], kecamatan: [], desa: [], fishType: [],
      containerType: [], businessType: [],
    });
    systemPrompt += dataContext;

    // Add KUSUKA data context for ALL questions (so AI knows KUSUKA data is available)
    const kusukaContext = await fetchKusukaDataContext();
    systemPrompt += kusukaContext;

    // Add stats context (compact) for stats/general questions
    if (questionType === 'stats' || questionType === 'general') {
      systemPrompt += buildCompactStats(statsContext);
    }

    // Add targeted results for specific questions (group/farmer details with member names)
    if (questionType === 'specific' || searchTerms.length > 0) {
      const targeted = await fetchTargetedResults(searchTerms, questionType);
      if (targeted) systemPrompt += targeted;

      // Also add KUSUKA targeted results for specific/search queries
      const kusukaTargeted = await fetchKusukaTargetedResults(searchTerms, questionType);
      if (kusukaTargeted) systemPrompt += kusukaTargeted;
    }

    // Log prompt size for debugging
    const promptChars = systemPrompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);
    const memoryCount = memories.length;
    console.log(`AI Chat: questionType=${questionType}, promptChars=${promptChars}, estTokens=${estimatedTokens}, searchTerms=${searchTerms.join(',')}, totalGroups=${totalGroups}, memories=${memoryCount}`);

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
