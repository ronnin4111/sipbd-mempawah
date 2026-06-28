import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

/** Maximum context characters sent to AI to avoid 413 errors */
const MAX_CONTEXT_CHARS = 8000;

/**
 * Build a compact context text from uploaded S1 Excel data in Turso
 * (tables: AnalyzeUpload → AnalyzeRow + AnalyzePopulasi).
 *
 * This produces the SAME numbers that are shown on the Analisis S1 dashboard,
 * so the AI narration will be consistent with the charts above it.
 */
async function buildAnalyzeS1Context(filterYear?: number, filterSemester?: number): Promise<string> {
  // 1. Find the latest AnalyzeUpload (optionally filtered by year)
  const where: { year?: number } = {};
  if (filterYear) where.year = filterYear;
  const upload = await db.analyzeUpload.findFirst({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      populasi: true,
    },
  });

  if (!upload) {
    throw new Error('NO_ANALYZE_DATA');
  }

  // 2. Fetch all rows for this upload
  const rows = await db.analyzeRow.findMany({
    where: { uploadId: upload.id },
    orderBy: [{ bulanNum: 'asc' }],
  });

  if (rows.length === 0) {
    throw new Error('NO_ANALYZE_DATA');
  }

  // 3. Filter by semester if requested
  const filteredRows = filterSemester
    ? rows.filter(r => r.semester === filterSemester)
    : rows;

  // 4. Compute aggregates
  const totalProduksiTon = filteredRows.reduce((s, r) => s + r.produksiTon, 0);
  const totalNilaiRp = filteredRows.reduce((s, r) => s + r.nilaiRp, 0);
  const totalPakanKg = filteredRows.reduce((s, r) => s + r.pakanKg, 0);
  const totalBenih = filteredRows.reduce((s, r) => s + r.agregatBenih, 0);
  const totalLuasLahan = filteredRows.reduce((s, r) => s + r.luasLahan, 0);

  // by komoditas
  const byKomoditas: Record<string, { ton: number; kg: number; rp: number; pakan: number; benih: number; fcr: number; sr: number; size: number; harga: number; n: number }> = {};
  for (const r of filteredRows) {
    const k = r.komoditas;
    if (!byKomoditas[k]) byKomoditas[k] = { ton: 0, kg: 0, rp: 0, pakan: 0, benih: 0, fcr: 0, sr: 0, size: 0, harga: 0, n: 0 };
    byKomoditas[k].ton += r.produksiTon;
    byKomoditas[k].kg += r.produksiKg;
    byKomoditas[k].rp += r.nilaiRp;
    byKomoditas[k].pakan += r.pakanKg;
    byKomoditas[k].benih += r.agregatBenih;
    byKomoditas[k].fcr += r.fcr * r.produksiTon; // weighted
    byKomoditas[k].sr += r.sr * r.produksiTon;   // weighted
    byKomoditas[k].size += r.size * r.produksiTon;
    byKomoditas[k].harga += r.hargaRpKg * r.produksiKg; // weighted
    byKomoditas[k].n += 1;
  }

  // by wadah
  const byWadah: Record<string, { ton: number; rp: number; n: number }> = {};
  for (const r of filteredRows) {
    const w = r.jenisWadah;
    if (!byWadah[w]) byWadah[w] = { ton: 0, rp: 0, n: 0 };
    byWadah[w].ton += r.produksiTon;
    byWadah[w].rp += r.nilaiRp;
    byWadah[w].n += 1;
  }

  // by bulan
  const byBulan: Record<string, { ton: number; rp: number }> = {};
  for (const r of filteredRows) {
    const b = r.bulan;
    if (!byBulan[b]) byBulan[b] = { ton: 0, rp: 0 };
    byBulan[b].ton += r.produksiTon;
    byBulan[b].rp += r.nilaiRp;
  }

  // by triwulan
  const byTw: Record<string, { ton: number; rp: number }> = {};
  for (const r of filteredRows) {
    const key = `TW ${r.tw}`;
    if (!byTw[key]) byTw[key] = { ton: 0, rp: 0 };
    byTw[key].ton += r.produksiTon;
    byTw[key].rp += r.nilaiRp;
  }

  // 5. Build text context
  const lines: string[] = [];

  const semesterLabel = filterSemester === 1 ? 'Semester 1 (Januari–Juni)'
    : filterSemester === 2 ? 'Semester 2 (Juli–Desember)'
    : 'Sepanjang Tahun';

  lines.push(`Sumber Data: Excel Analisis Disagregasi (file: ${upload.fileName})`);
  lines.push(`Tahun: ${upload.year}`);
  lines.push(`Periode: ${semesterLabel}`);
  lines.push(`Jenis Usaha: ${upload.businessType}`);
  lines.push(`Diupload: ${new Date(upload.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  lines.push(`Total baris data: ${filteredRows.length}`);
  lines.push('');

  // Totals
  lines.push('=== RINGKASAN TOTAL ===');
  lines.push(`Total Produksi: ${totalProduksiTon.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Ton (${Math.round(totalProduksiTon * 1000).toLocaleString('id-ID')} Kg)`);
  lines.push(`Total Nilai Ekonomi: Rp ${totalNilaiRp.toLocaleString('id-ID')} (${(totalNilaiRp / 1e9).toFixed(2).replace('.', ',')} Miliar)`);
  lines.push(`Total Pakan: ${totalPakanKg.toLocaleString('id-ID')} Kg`);
  lines.push(`Total Benih (agregat): ${Math.round(totalBenih).toLocaleString('id-ID')} Ekor`);
  lines.push(`Total Luas Lahan: ${totalLuasLahan.toLocaleString('id-ID')} m²`);
  lines.push('');

  // Per komoditas
  lines.push('=== PRODUKSI PER KOMODITAS ===');
  const komEntries = Object.entries(byKomoditas).sort((a, b) => b[1].ton - a[1].ton);
  for (const [k, v] of komEntries) {
    const wFcr = v.ton > 0 ? (v.fcr / v.ton).toFixed(2) : '0';
    const wSr = v.ton > 0 ? (v.sr / v.ton * 100).toFixed(1) : '0';
    const wSize = v.ton > 0 ? (v.size / v.ton).toFixed(0) : '0';
    const wHarga = v.kg > 0 ? Math.round(v.harga / v.kg).toLocaleString('id-ID') : '0';
    const pct = totalProduksiTon > 0 ? (v.ton / totalProduksiTon * 100).toFixed(1) : '0';
    lines.push(`  ${k}: ${v.ton.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Ton (${pct}%), Rp ${v.rp.toLocaleString('id-ID')}, FCR=${wFcr}, SR=${wSr}%, Size=${wSize}, Harga=Rp${wHarga}/Kg, Benih=${Math.round(v.benih).toLocaleString('id-ID')} Ekor`);
  }
  lines.push('');

  // Per wadah
  lines.push('=== PRODUKSI PER JENIS WADAH ===');
  const wadahEntries = Object.entries(byWadah).sort((a, b) => b[1].ton - a[1].ton);
  for (const [w, v] of wadahEntries) {
    lines.push(`  ${w}: ${v.ton.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Ton, Rp ${v.rp.toLocaleString('id-ID')}`);
  }
  lines.push('');

  // Per bulan (trend)
  lines.push('=== TREN PRODUKSI PER BULAN ===');
  const bulanOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  for (const b of bulanOrder) {
    if (byBulan[b]) {
      const v = byBulan[b];
      lines.push(`  ${b}: ${v.ton.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Ton, Rp ${v.rp.toLocaleString('id-ID')}`);
    }
  }
  lines.push('');

  // Per triwulan
  lines.push('=== PRODUKSI PER TRIWULAN ===');
  for (const [tw, v] of Object.entries(byTw)) {
    lines.push(`  ${tw}: ${v.ton.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Ton, Rp ${v.rp.toLocaleString('id-ID')}`);
  }
  lines.push('');

  // Populasi
  if (upload.populasi.length > 0) {
    lines.push('=== DATA POPULASI ===');
    let totalRtp = 0;
    let totalPemb = 0;
    let totalLuas = 0;
    for (const p of upload.populasi) {
      lines.push(`  ${p.jenisWadah}: RTP=${p.jumlahRtp}, Pembudidaya=${p.jumlahPembudidaya}, Luas Lahan=${p.luasLahan.toLocaleString('id-ID')} m²`);
      totalRtp += p.jumlahRtp;
      totalPemb += p.jumlahPembudidaya;
      totalLuas += p.luasLahan;
    }
    lines.push(`  TOTAL: RTP=${totalRtp}, Pembudidaya=${totalPemb}, Luas Lahan=${totalLuas.toLocaleString('id-ID')} m²`);
  }

  return lines.join('\n');
}

/**
 * Format statsContext into a compact, readable text summary
 * instead of raw JSON (which can be huge and cause 413 errors).
 */
function formatStatsContextToText(statsContext: Record<string, unknown>): string {
  const s = statsContext;
  const lines: string[] = [];

  // Period / year info
  if (s.periodLabel) lines.push(`Periode: ${s.periodLabel}`);
  if (s.currentYear) lines.push(`Tahun: ${s.currentYear}`);

  // Production totals
  if (s.pembesaranProduction !== undefined) {
    lines.push(`Produksi Pembesaran: ${Number(s.pembesaranProduction).toLocaleString('id-ID')} Kg`);
  }
  if (s.pembenihanProduction !== undefined) {
    lines.push(`Produksi Pembenihan: ${Number(s.pembenihanProduction).toLocaleString('id-ID')} Ekor`);
  }

  // Counts
  if (s.totalRtp !== undefined) lines.push(`Total RTP: ${Number(s.totalRtp).toLocaleString('id-ID')}`);
  if (s.totalFarmer !== undefined) lines.push(`Total Pembudidaya: ${Number(s.totalFarmer).toLocaleString('id-ID')}`);
  if (s.totalGroup !== undefined) lines.push(`Total Kelompok: ${Number(s.totalGroup).toLocaleString('id-ID')}`);
  if (s.totalKusuka !== undefined) lines.push(`Total KUSUKA: ${Number(s.totalKusuka).toLocaleString('id-ID')}`);

  // Production by fish type (compact)
  // Stats API returns: Record<string, { pembesaran: number; pembenihan: number }>
  if (s.productionByFishType && typeof s.productionByFishType === 'object') {
    const fishData = s.productionByFishType as Record<string, { pembesaran: number; pembenihan: number }>;
    lines.push('Produksi per jenis ikan:');
    for (const [k, v] of Object.entries(fishData)) {
      if (typeof v === 'object' && v !== null) {
        const pemb = Number(v.pembesaran || 0).toLocaleString('id-ID');
        const pemben = Number(v.pembenihan || 0).toLocaleString('id-ID');
        lines.push(`  ${k}: Pembesaran=${pemb}Kg, Pembenihan=${pemben}Ekor`);
      } else {
        lines.push(`  ${k}: ${Number(v).toLocaleString('id-ID')}`);
      }
    }
  }

  // Production by kecamatan (compact)
  // Stats API returns: Record<string, { pembesaran: number; pembenihan: number }>
  if (s.productionByKecamatan && typeof s.productionByKecamatan === 'object') {
    const kecData = s.productionByKecamatan as Record<string, { pembesaran: number; pembenihan: number }>;
    lines.push('Produksi per kecamatan:');
    const sorted = Object.entries(kecData).sort(([, a], [, b]) => {
      const totalA = Number(a.pembesaran || 0) + Number(a.pembenihan || 0);
      const totalB = Number(b.pembesaran || 0) + Number(b.pembenihan || 0);
      return totalB - totalA;
    });
    for (const [k, v] of sorted) {
      if (typeof v === 'object' && v !== null) {
        const pemb = Number(v.pembesaran || 0).toLocaleString('id-ID');
        const pemben = Number(v.pembenihan || 0).toLocaleString('id-ID');
        lines.push(`  ${k}: Pembesaran=${pemb}Kg, Pembenihan=${pemben}Ekor`);
      } else {
        lines.push(`  ${k}: ${Number(v).toLocaleString('id-ID')}`);
      }
    }
  }

  // Kecamatan detail (compact — just top level summary)
  // Stats API returns: Record<string, { rtp, farmer, group, pembesaranProduction, pembenihanProduction, ... }>
  if (s.productionByKecamatanDetail && typeof s.productionByKecamatanDetail === 'object') {
    const kecDetail = s.productionByKecamatanDetail as Record<string, unknown>;
    lines.push('Detail per kecamatan:');
    for (const [kec, detail] of Object.entries(kecDetail).slice(0, 10)) {
      const d = detail as Record<string, unknown>;
      const pembProd = d.pembesaranProduction ? `Pembesaran:${Number(d.pembesaranProduction).toLocaleString('id-ID')}Kg` : '';
      const pembenProd = d.pembenihanProduction ? `Pembenihan:${Number(d.pembenihanProduction).toLocaleString('id-ID')}Ekor` : '';
      const summary = [
        pembProd,
        pembenProd,
        d.rtp ? `RTP:${Number(d.rtp).toLocaleString('id-ID')}` : '',
        d.farmer ? `Pembudidaya:${Number(d.farmer).toLocaleString('id-ID')}` : '',
        d.group ? `Kelompok:${Number(d.group).toLocaleString('id-ID')}` : '',
      ].filter(Boolean).join(', ');
      lines.push(`  ${kec}: ${summary}`);
    }
    if (Object.keys(kecDetail).length > 10) {
      lines.push(`  ...dan ${Object.keys(kecDetail).length - 10} kecamatan lainnya`);
    }
  }

  // Fish type detail (compact)
  // Stats API returns: Record<string, { pembesaranProduction, pembenihanProduction, rtp, farmer, group, ... }>
  if (s.productionByFishTypeDetail && typeof s.productionByFishTypeDetail === 'object') {
    const fishDetail = s.productionByFishTypeDetail as Record<string, unknown>;
    lines.push('Detail per jenis ikan:');
    for (const [fish, detail] of Object.entries(fishDetail)) {
      const d = detail as Record<string, unknown>;
      const summary = [
        d.pembesaranProduction ? `Pembesaran:${Number(d.pembesaranProduction).toLocaleString('id-ID')}Kg` : '',
        d.pembenihanProduction ? `Pembenihan:${Number(d.pembenihanProduction).toLocaleString('id-ID')}Ekor` : '',
        d.rtp ? `RTP:${Number(d.rtp).toLocaleString('id-ID')}` : '',
        d.farmer ? `Pembudidaya:${Number(d.farmer).toLocaleString('id-ID')}` : '',
        d.group ? `Kelompok:${Number(d.group).toLocaleString('id-ID')}` : '',
      ].filter(Boolean).join(', ');
      if (summary) lines.push(`  ${fish}: ${summary}`);
    }
  }

  // 5-year trend
  // Stats API returns: Record<string, { pembesaran: number; pembenihan: number }> (key = year as string)
  if (s.trend5Year && typeof s.trend5Year === 'object') {
    const trend = s.trend5Year as Record<string, { pembesaran: number; pembenihan: number }>;
    const trendEntries = Object.entries(trend).sort(([a], [b]) => Number(a) - Number(b));
    if (trendEntries.length > 0) {
      lines.push('Tren 5 tahun:');
      for (const [year, v] of trendEntries) {
        const pemb = Number(v.pembesaran || 0).toLocaleString('id-ID');
        const pemben = Number(v.pembenihan || 0).toLocaleString('id-ID');
        lines.push(`  ${year}: Pembesaran=${pemb}Kg, Pembenihan=${pemben}Ekor`);
      }
    }
  }

  // Target vs realisasi pembesaran
  if (s.targetVsRealisasiPembesaran && typeof s.targetVsRealisasiPembesaran === 'object') {
    const targets = s.targetVsRealisasiPembesaran as Record<string, unknown>;
    lines.push('Target vs Realisasi Pembesaran:');
    for (const [k, v] of Object.entries(targets)) {
      const d = v as Record<string, unknown>;
      const target = Number(d.target || 0).toLocaleString('id-ID');
      const realisasi = Number(d.realisasi || 0).toLocaleString('id-ID');
      const pct = d.target && Number(d.target) > 0
        ? ` (${Math.round(Number(d.realisasi || 0) / Number(d.target) * 100)}%)`
        : '';
      lines.push(`  ${k}: target=${target}, realisasi=${realisasi}${pct}`);
    }
  }

  // Target vs realisasi pembenihan
  if (s.targetVsRealisasiPembenihan && typeof s.targetVsRealisasiPembenihan === 'object') {
    const targets = s.targetVsRealisasiPembenihan as Record<string, unknown>;
    lines.push('Target vs Realisasi Pembenihan:');
    for (const [k, v] of Object.entries(targets)) {
      const d = v as Record<string, unknown>;
      const target = Number(d.target || 0).toLocaleString('id-ID');
      const realisasi = Number(d.realisasi || 0).toLocaleString('id-ID');
      const pct = d.target && Number(d.target) > 0
        ? ` (${Math.round(Number(d.realisasi || 0) / Number(d.target) * 100)}%)`
        : '';
      lines.push(`  ${k}: target=${target}, realisasi=${realisasi}${pct}`);
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

/**
 * Get available years from database for AI context.
 */
async function getAvailableYears(): Promise<number[]> {
  try {
    const result = await db.fishFarm.findMany({
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    return result.map(r => r.year).filter((y): y is number => typeof y === 'number');
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();
    const body = await request.json();
    const { statsContext, type = 'summary', source, year, semester } = body as {
      statsContext?: Record<string, unknown>;
      type?: 'summary' | 'trend' | 'kecamatan' | 'target';
      source?: 'fishfarm' | 'analyze-s1';
      year?: number;
      semester?: number;
    };

    // ─── Branch: Analyze S1 data source (Excel upload → Turso) ─────────────
    if (source === 'analyze-s1') {
      let contextText: string;
      try {
        contextText = await buildAnalyzeS1Context(year, semester);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg === 'NO_ANALYZE_DATA') {
          return NextResponse.json({
            success: false,
            error: 'Belum ada data Analisis S1',
            detail: 'Silakan upload Excel Pembesaran/Semester lewat menu Disagregasi → Upload Excel terlebih dahulu. Setelah upload, data tersimpan otomatis ke database Turso dan akan langsung dipakai AI untuk narasi.',
          }, { status: 404 });
        }
        throw err;
      }

      // Enforce size budget
      if (contextText.length > MAX_CONTEXT_CHARS) {
        const truncated = contextText.substring(0, MAX_CONTEXT_CHARS);
        contextText = truncated + '\n\n[Data dipangkas karena terlalu panjang. Data yang ditampilkan sudah cukup untuk analisis.]';
      }

      const antiHallucinationRules = `

⚠️ ATURAN ANTI-HALLUCINASI (WAJIB DIPATUHI):
1. HANYA gunakan angka yang ada di data. JANGAN membuat angka, membulatkan, atau mengubah satuan.
2. JANGAN menggunakan kategori yang tidak ada di data. Kategori yang ada: Produksi (Ton/Kg), Nilai (Rp), Pakan (Kg), Benih (Ekor), FCR, SR (%), Size, Harga (Rp/Kg), Luas Lahan (m²), RTP, Pembudidaya.
3. JANGAN membuat kategori baru seperti "Pembesaran vs Pembenihan" — data ini hanya berisi PEMBESARAN ikan.
4. Jika data kosong atau tidak ada, katakan "Data tidak tersedia" — JANGAN mengarang angka.
5. Format angka dengan separator ribuan Indonesia (1.234.567).
6. KONTEKS PENTING: Data ini berasal dari Excel "Rekap Produksi Pembesaran Ikan" yang diupload admin, bukan dari database FishFarm global. Jadi angka-angka di sini adalah angka RESMI yang dilaporkan.`;

      const prompts: Record<string, string> = {
        summary: `Anda adalah narator laporan perikanan budidaya profesional. Buatkan narasi ringkasan produksi Pembesaran Ikan Semester 1 (Januari–Juni) Kabupaten Mempawah berdasarkan data Excel Rekap Produksi yang diupload admin.

PENTING: Data yang diberikan adalah data resmi dari Excel Rekap Produksi Pembesaran Ikan dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Narasi harus:
- Ditulis dalam Bahasa Indonesia yang formal namun mudah dipahami
- Menyebutkan total produksi (Ton), total nilai ekonomi (Rp Miliar), dan kontribusi per komoditas
- Menyoroti komoditas dominan dan penyumbang kecil
- Menyebutkan trend bulanan (naik/turun, bulan puncak & terendah)
- Memberikan rekomendasi singkat berbasis data (misal: diversifikasi komoditas, perluasan wadah produktif)
- Panjang 3-5 paragraf
- Cocok untuk laporan dinas`,

        trend: `Anda adalah analis data perikanan budidaya. Analisis tren produksi Pembesaran Ikan per bulan dalam Semester 1 (Januari–Juni) Kabupaten Mempawah berdasarkan data Excel Rekap Produksi yang diupload admin.

PENTING: Data yang diberikan adalah data resmi dari Excel Rekap Produksi Pembesaran Ikan dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Fokuskan analisis pada:
- Tren produksi bulanan (Januari sampai Juni) — kapan naik, kapan turun
- Perbandingan TW 1 vs TW 2
- Bulan dengan produksi tertinggi & terendah, dan persentase perubahannya
- Perbedaan performa antar komoditas dari bulan ke bulan
- Rekomendasi strategis (misal: antisipasi penurunan produksi, optimalisasi musim)
- Format angka dengan separator ribuan (1.234.567)`,

        kecamatan: `Anda adalah analis perbandingan wilayah perikanan budidaya. Buatkan analisis perbandingan produksi Pembesaran Ikan antar JENIS WADAH di Kabupaten Mempawah berdasarkan data Excel Rekap Produksi yang diupload admin.

PENTING: Data yang diberikan adalah data resmi dari Excel Rekap Produksi Pembesaran Ikan dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Catatan penting: Data Excel ini TIDAK memiliki kolom kecamatan (semua data adalah level kabupaten Mempawah). Jadi sebagai gantinya, fokuskan analisis pada PERBANDINGAN ANTAR JENIS WADAH (Jaring Apung Tawar, Kolam Air Tenang, Tambak Intensif):

- Wadah dengan produksi tertinggi dan terendah
- Distribusi RTP, pembudidaya, dan luas lahan per wadah
- Produktifitas per wadah (Ton per m² atau Ton per RTP)
- Kesenjangan performa antar wadah
- Rekomendasi peningkatan/ekspansi wadah tertentu
- Format angka dengan separator ribuan (1.234.567)`,

        target: `Anda adalah analis pencapaian produksi perikanan budidaya. Analisis efisiensi produksi Pembesaran Ikan Semester 1 Kabupaten Mempawah berdasarkan data Excel Rekap Produksi yang diupload admin.

PENTING: Data yang diberikan adalah data resmi dari Excel Rekap Produksi Pembesaran Ikan dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Catatan penting: Data Excel ini TIDAK memiliki kolom target vs realisasi. Sebagai gantinya, fokuskan analisis pada INDIKATOR EFISIENSI PRODUKSI:

- FCR (Feed Conversion Ratio) per komoditas — mana yang paling efisien?
- SR (Survival Rate) per komoditas — mana yang tinggi/rendah?
- Size (ukuran panen) per komoditas
- Harga jual rata-rata per komoditas
- Hubungan antara FCR, SR, dan produktifitas
- Rekomendasi: komoditas mana yang perlu ditingkatkan efisiensinya
- Format angka dengan separator ribuan (1.234.567)`,
      };

      const systemPrompt = prompts[type] || prompts.summary;

      const result = await callAI({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Berikut data produksi Pembesaran Ikan Semester 1 Kabupaten Mempawah yang diambil dari database Turso ( hasil parse Excel Rekap Produksi ):\n\n${contextText}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      if (!result.success) {
        console.error('AI Narrate (analyze-s1) error:', result.error);
        let userError = 'Gagal menghasilkan narasi';
        let errorDetail = result.error || '';
        if (errorDetail.includes('API Key belum dikonfigurasi') || errorDetail.includes('🔑')) {
          userError = 'API Key belum dikonfigurasi';
          errorDetail = 'Klik ikon ⚙️ di chat AI untuk mengatur API key (Gemini/Groq — gratis!).';
        } else if (errorDetail.includes('413') || errorDetail.includes('too large')) {
          userError = 'Data terlalu besar untuk diproses AI';
          errorDetail = 'Coba pilih filter semester atau tahun tertentu.';
        } else if (errorDetail.includes('Rate limited') || errorDetail.includes('429')) {
          userError = 'AI sedang sibuk';
          errorDetail = 'Batas permintaan tercapai. Tunggu beberapa saat lalu coba lagi.';
        }
        return NextResponse.json({ success: false, error: userError, detail: errorDetail }, { status: 500 });
      }

      const narrative = result.content || 'Tidak dapat menghasilkan narasi saat ini.';
      return NextResponse.json({
        success: true,
        narrative,
        type,
        source: 'analyze-s1',
        provider: result.provider,
      });
    }

    // ─── Default branch: FishFarm stats (existing behavior) ────────────────
    if (!statsContext) {
      return NextResponse.json(
        { error: 'statsContext is required (or set source=analyze-s1)' },
        { status: 400 }
      );
    }

    // Format statsContext to compact text instead of raw JSON
    let contextText = formatStatsContextToText(statsContext);

    // Add available years info from database
    const availableYears = await getAvailableYears();
    if (availableYears.length > 0) {
      contextText = `Tahun data tersedia: ${availableYears.join(', ')}\n\n${contextText}`;
    }

    // Enforce size budget to avoid 413 errors
    if (contextText.length > MAX_CONTEXT_CHARS) {
      const truncated = contextText.substring(0, MAX_CONTEXT_CHARS);
      contextText = truncated + '\n\n[Data dipangkas karena terlalu panjang. Data yang ditampilkan sudah cukup untuk analisis.]';
    }

    const antiHallucinationRules = `

⚠️ ATURAN ANTI-HALLUCINASI (WAJIB DIPATUHI):
1. HANYA gunakan angka yang ada di data. JANGAN membuat angka, membulatkan, atau mengubah satuan.
2. JANGAN menggunakan kategori yang tidak ada di data. Kategori yang ada: Produksi Pembesaran (Kg), Produksi Pembenihan (Ekor), RTP, Kelompok, Pembudidaya, KUSUKA.
3. JANGAN membuat kategori baru seperti "Produksi Laut" atau "Produksi Air Tawar" — kategori tersebut TIDAK ADA.
4. Jika data kosong atau tidak ada, katakan "Data tidak tersedia" — JANGAN mengarang angka.
5. Format angka dengan separator ribuan Indonesia (1.234.567).`;

    const prompts: Record<string, string> = {
      summary: `Anda adalah narator laporan perikanan budidaya profesional. Buatkan narasi ringkasan produksi perikanan budidaya Kabupaten Mempawah berdasarkan data berikut.

PENTING: Data yang diberikan sudah diquery dari database dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Narasi harus:
- Ditulis dalam Bahasa Indonesia yang formal namun mudah dipahami
- Menyebutkan angka-angka penting (format ribuan: 1.234.567)
- Menyoroti pencapaian dan tantangan
- Memberikan rekomendasi singkat
- Panjang 3-5 paragraf
- Cocok untuk laporan dinas`,

      trend: `Anda adalah analis data perikanan budidaya. Analisis tren produksi 5 tahun terakhir Kabupaten Mempawah berdasarkan data berikut.

PENTING: Data yang diberikan sudah diquery dari database dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Fokuskan analisis pada:
- Tren naik/turun per jenis usaha (Pembesaran/Pembenihan)
- Perubahan signifikan antar tahun
- Prediksi arah tren
- Rekomendasi strategis
- Format angka dengan separator ribuan (1.234.567)`,

      kecamatan: `Anda adalah analis perbandingan wilayah perikanan budidaya. Buatkan analisis perbandingan produksi antar kecamatan di Kabupaten Mempawah berdasarkan data berikut.

PENTING: Data yang diberikan sudah diquery dari database dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Fokuskan pada:
- Kecamatan dengan produksi tertinggi dan terendah
- Distribusi RTP dan kelompok per wilayah
- Kesenjangan antar kecamatan
- Rekomendasi pemerataan
- Format angka dengan separator ribuan (1.234.567)`,

      target: `Anda adalah evaluator pencapaian target perikanan budidaya. Analisis pencapaian target vs realisasi produksi Kabupaten Mempawah berdasarkan data berikut.

PENTING: Data yang diberikan sudah diquery dari database dan SUDAH BENAR. Gunakan angka-angka tersebut langsung — JANGAN bilang data tidak tersedia jika ada angka di data.${antiHallucinationRules}

Fokuskan pada:
- Jenis ikan yang melampaui target (overachieving)
- Jenis ikan yang di bawah target (underachieving)
- Persentase pencapaian per jenis ikan
- Rekomendasi peningkatan
- Format angka dengan separator ribuan (1.234.567) dan persentase`,
    };

    const systemPrompt = prompts[type] || prompts.summary;

    const result = await callAI({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Berikut data produksi perikanan budidaya Kabupaten Mempawah:\n\n${contextText}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    if (!result.success) {
      console.error('AI Narrate error:', result.error);

      // Provide user-friendly error messages
      let userError = 'Gagal menghasilkan narasi';
      let errorDetail = result.error || '';

      if (errorDetail.includes('API Key belum dikonfigurasi') || errorDetail.includes('🔑')) {
        userError = 'API Key belum dikonfigurasi';
        errorDetail = 'Klik ikon ⚙️ di chat AI untuk mengatur API key (Gemini/Groq — gratis!).';
      } else if (errorDetail.includes('413') || errorDetail.includes('Request entity too large') || errorDetail.includes('too large')) {
        userError = 'Data terlalu besar untuk diproses AI';
        errorDetail = 'Coba pilih filter yang lebih spesifik (misalnya tahun tertentu atau kecamatan tertentu) lalu coba lagi.';
      } else if (errorDetail.includes('Rate limited') || errorDetail.includes('429') || errorDetail.includes('rate_limit')) {
        userError = 'AI sedang sibuk';
        errorDetail = 'Batas permintaan tercapai. Tunggu beberapa saat lalu coba lagi.';
      } else if (errorDetail.includes('Semua provider AI gagal')) {
        userError = 'Semua layanan AI sedang tidak tersedia';
        errorDetail = 'Server AI sedang mengalami gangguan. Coba lagi dalam beberapa menit.';
      }

      return NextResponse.json(
        {
          success: false,
          error: userError,
          detail: errorDetail,
        },
        { status: 500 }
      );
    }

    const narrative = result.content || 'Tidak dapat menghasilkan narasi saat ini.';

    return NextResponse.json({
      success: true,
      narrative,
      type,
      provider: result.provider,
    });
  } catch (error: unknown) {
    console.error('AI Narrator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error for common issues
    let userError = 'Gagal menghasilkan narasi';
    let errorDetail = errorMessage;

    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      userError = 'Gagal terhubung ke server AI';
      errorDetail = 'Periksa koneksi internet dan coba lagi.';
    }

    return NextResponse.json(
      { success: false, error: userError, detail: errorDetail },
      { status: 500 }
    );
  }
}

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic';
