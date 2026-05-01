import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

// Helper to build filter
function buildWhere(searchParams: URLSearchParams) {
  const where: Record<string, unknown> = {};

  const yearParam = searchParams.get('year');
  if (yearParam) {
    const years = yearParam.split(',').map(Number).filter(n => !isNaN(n));
    if (years.length > 0) where.year = { in: years };
  }

  const kecamatanParam = searchParams.get('kecamatan');
  if (kecamatanParam) {
    const list = kecamatanParam.split(',').filter(Boolean);
    if (list.length > 0) where.kecamatan = { in: list };
  }

  const desaParam = searchParams.get('desa');
  if (desaParam) {
    const list = desaParam.split(',').filter(Boolean);
    if (list.length > 0) where.desa = { in: list };
  }

  const fishTypeParam = searchParams.get('fishType');
  if (fishTypeParam) {
    const list = fishTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.fishType = { in: list };
  }

  const containerTypeParam = searchParams.get('containerType');
  if (containerTypeParam) {
    const list = containerTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.containerType = { in: list };
  }

  const businessTypeParam = searchParams.get('businessType');
  if (businessTypeParam) {
    const list = businessTypeParam.split(',').filter(Boolean);
    if (list.length > 0) where.businessType = { in: list };
  }

  const searchParam = searchParams.get('search');
  if (searchParam) {
    where.OR = [
      { kecamatan: { contains: searchParam } },
      { desa: { contains: searchParam } },
      { fishType: { contains: searchParam } },
      { containerType: { contains: searchParam } },
      { farmerName: { contains: searchParam } },
      { groupName: { contains: searchParam } },
    ];
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildWhere(searchParams);

    const records = await db.fishFarm.findMany({
      where,
      orderBy: [{ year: 'desc' }, { kecamatan: 'asc' }, { desa: 'asc' }],
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Data Produksi - all fish farm data (re-importable format)
    const dataProduksiHeaders = [
      'year', 'kecamatan', 'desa', 'fishType', 'containerType', 'businessType',
      'farmerName', 'groupName',
      'productionQty', 'rtpCount', 'farmerCount', 'groupCount',
      'targetQty', 'productionValue', 'latitude', 'longitude',
    ];
    const dataProduksiRows = records.map(r => [
      r.year, r.kecamatan, r.desa, r.fishType, r.containerType, r.businessType,
      r.farmerName, r.groupName,
      r.productionQty, r.rtpCount, r.farmerCount, r.groupCount,
      r.targetQty, r.productionValue, r.latitude, r.longitude,
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([dataProduksiHeaders, ...dataProduksiRows]);

    // Set column widths
    ws1['!cols'] = [
      { wch: 8 },  // year
      { wch: 20 }, // kecamatan
      { wch: 25 }, // desa
      { wch: 18 }, // fishType
      { wch: 20 }, // containerType
      { wch: 15 }, // businessType
      { wch: 20 }, // farmerName
      { wch: 20 }, // groupName
      { wch: 15 }, // productionQty
      { wch: 10 }, // rtpCount
      { wch: 12 }, // farmerCount
      { wch: 10 }, // groupCount
      { wch: 12 }, // targetQty
      { wch: 18 }, // productionValue
      { wch: 12 }, // latitude
      { wch: 12 }, // longitude
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Data Produksi');

    // Sheet 2: Produksi Per Kecamatan
    const kecDetail: Record<string, { production: number; value: number; rtp: number; farmer: number; group: number }> = {};
    records.forEach(r => {
      if (!kecDetail[r.kecamatan]) {
        kecDetail[r.kecamatan] = { production: 0, value: 0, rtp: 0, farmer: 0, group: 0 };
      }
      kecDetail[r.kecamatan].production += r.productionQty;
      kecDetail[r.kecamatan].value += r.productionValue;
      kecDetail[r.kecamatan].rtp += r.rtpCount;
      kecDetail[r.kecamatan].farmer += r.farmerCount;
      kecDetail[r.kecamatan].group += r.groupCount;
    });

    const kecHeaders = ['Kecamatan', 'Produksi (Kg)', 'Nilai Produksi (Rp)', 'RTP', 'Pembudidaya', 'Kelompok'];
    const kecRows = Object.entries(kecDetail).map(([kec, d]) => [
      kec,
      Math.round(d.production * 100) / 100,
      Math.round(d.value * 100) / 100,
      d.rtp,
      d.farmer,
      d.group,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([kecHeaders, ...kecRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Produksi Per Kecamatan');

    // Sheet 3: Target vs Realisasi
    const targetRealisasi: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (!targetRealisasi[r.fishType]) {
        targetRealisasi[r.fishType] = { target: 0, realisasi: 0 };
      }
      targetRealisasi[r.fishType].target += r.targetQty;
      targetRealisasi[r.fishType].realisasi += r.productionQty;
    });

    const targetHeaders = ['Jenis Ikan', 'Target (Kg)', 'Realisasi (Kg)', 'Persentase (%)'];
    const targetRows = Object.entries(targetRealisasi).map(([fish, d]) => [
      fish,
      Math.round(d.target * 100) / 100,
      Math.round(d.realisasi * 100) / 100,
      d.target > 0 ? Math.round((d.realisasi / d.target) * 10000) / 100 : 0,
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([targetHeaders, ...targetRows]);
    ws3['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Target vs Realisasi');

    // Sheet 4: Trend 5 Tahun
    const trend: Record<number, { pembesaran: number; pembenihan: number; total: number }> = {};
    records.forEach(r => {
      if (!trend[r.year]) {
        trend[r.year] = { pembesaran: 0, pembenihan: 0, total: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trend[r.year].pembesaran += r.productionQty;
      } else {
        trend[r.year].pembenihan += r.productionQty;
      }
      trend[r.year].total += r.productionQty;
    });

    const trendHeaders = ['Tahun', 'Pembesaran (Kg)', 'Pembenihan (Kg)', 'Total (Kg)'];
    const trendRows = Object.entries(trend)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, d]) => [
        Number(year),
        Math.round(d.pembesaran * 100) / 100,
        Math.round(d.pembenihan * 100) / 100,
        Math.round(d.total * 100) / 100,
      ]);
    const ws4 = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
    ws4['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Trend 5 Tahun');

    // Sheet 5: RTP & Pembudidaya
    const businessSummary: Record<string, { rtp: number; farmer: number; group: number; production: number }> = {};
    records.forEach(r => {
      if (!businessSummary[r.businessType]) {
        businessSummary[r.businessType] = { rtp: 0, farmer: 0, group: 0, production: 0 };
      }
      businessSummary[r.businessType].rtp += r.rtpCount;
      businessSummary[r.businessType].farmer += r.farmerCount;
      businessSummary[r.businessType].group += r.groupCount;
      businessSummary[r.businessType].production += r.productionQty;
    });

    const businessHeaders = ['Jenis Usaha', 'RTP', 'Pembudidaya', 'Kelompok', 'Produksi (Kg)'];
    const businessRows = Object.entries(businessSummary).map(([type, d]) => [
      type,
      d.rtp,
      d.farmer,
      d.group,
      Math.round(d.production * 100) / 100,
    ]);
    const ws5 = XLSX.utils.aoa_to_sheet([businessHeaders, ...businessRows]);
    ws5['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'RTP & Pembudidaya');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="data-perikanan-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting fish farms to Excel:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
