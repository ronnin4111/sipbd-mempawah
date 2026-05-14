import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai-sdk';
import { db } from '@/lib/db';

/** Maximum context characters sent to AI to avoid 413 errors */
const MAX_CONTEXT_CHARS = 8000;

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
    const body = await request.json();
    const { statsContext, type = 'summary' } = body as {
      statsContext?: Record<string, unknown>;
      type?: 'summary' | 'trend' | 'kecamatan' | 'target';
    };

    if (!statsContext) {
      return NextResponse.json(
        { error: 'statsContext is required' },
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
