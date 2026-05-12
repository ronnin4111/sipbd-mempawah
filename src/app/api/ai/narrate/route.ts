import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Singleton ZAI instance
let zaiInstance: InstanceType<typeof ZAI> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
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

    const zai = await getZAI();

    const prompts: Record<string, string> = {
      summary: `Anda adalah narator laporan perikanan budidaya profesional. Buatkan narasi ringkasan produksi perikanan budidaya Kabupaten Mempawah berdasarkan data berikut.

Narasi harus:
- Ditulis dalam Bahasa Indonesia yang formal namun mudah dipahami
- Menyebutkan angka-angka penting (format ribuan: 1.234.567)
- Menyoroti pencapaian dan tantangan
- Memberikan rekomendasi singkat
- Panjang 3-5 paragraf
- Cocok untuk laporan dinas`,

      trend: `Anda adalah analis data perikanan budidaya. Analisis tren produksi 5 tahun terakhir Kabupaten Mempawah berdasarkan data berikut.

Fokuskan analisis pada:
- Tren naik/turun per jenis usaha (Pembesaran/Pembenihan)
- Perubahan signifikan antar tahun
- Prediksi arah tren
- Rekomendasi strategis
- Format angka dengan separator ribuan (1.234.567)`,

      kecamatan: `Anda adalah analis perbandingan wilayah perikanan budidaya. Buatkan analisis perbandingan produksi antar kecamatan di Kabupaten Mempawah berdasarkan data berikut.

Fokuskan pada:
- Kecamatan dengan produksi tertinggi dan terendah
- Distribusi RTP dan kelompok per wilayah
- Kesenjangan antar kecamatan
- Rekomendasi pemerataan
- Format angka dengan separator ribuan (1.234.567)`,

      target: `Anda adalah evaluator pencapaian target perikanan budidaya. Analisis pencapaian target vs realisasi produksi Kabupaten Mempawah berdasarkan data berikut.

Fokuskan pada:
- Jenis ikan yang melampaui target (overachieving)
- Jenis ikan yang di bawah target (underachieving)
- Persentase pencapaian per jenis ikan
- Rekomendasi peningkatan
- Format angka dengan separator ribuan (1.234.567) dan persentase`,
    };

    const systemPrompt = prompts[type] || prompts.summary;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: `Berikut data produksi perikanan budidaya Kabupaten Mempawah:\n\n${JSON.stringify(statsContext, null, 2)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const narrative = completion.choices[0]?.message?.content ||
      'Tidak dapat menghasilkan narasi saat ini.';

    return NextResponse.json({
      success: true,
      narrative,
      type,
    });
  } catch (error: unknown) {
    console.error('AI Narrator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Gagal menghasilkan narasi', detail: errorMessage },
      { status: 500 }
    );
  }
}
