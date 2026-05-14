import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

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

  const groupNameParam = searchParams.get('groupName');
  if (groupNameParam) {
    const list = groupNameParam.split(',').filter(Boolean);
    if (list.length > 0) where.groupName = { in: list };
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

    // Sheet 1: Data Pembudidaya - all fish farm data (re-importable format)
    const dataProduksiHeaders = [
      'year', 'kecamatan', 'desa', 'fishType', 'containerType', 'businessType',
      'farmerName', 'groupName',
      'productionQty', 'rtpCount', 'farmerCount', 'groupCount',
      'targetQty', 'productionValue', 'latitude', 'longitude',
      'kusuka', 'cpib', 'cbib',
    ];
    const dataProduksiRows = records.map(r => [
      r.year, r.kecamatan, r.desa, r.fishType, r.containerType, r.businessType,
      r.farmerName, r.groupName,
      r.productionQty, r.rtpCount, r.farmerCount, r.groupCount,
      r.targetQty, r.productionValue, r.latitude, r.longitude,
      r.kusuka || '', r.cpib ? 'Ya' : 'Tidak', r.cbib ? 'Ya' : 'Tidak',
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([dataProduksiHeaders, ...dataProduksiRows]);

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
      { wch: 20 }, // kusuka (16 digit)
      { wch: 10 }, // cpib
      { wch: 10 }, // cbib
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Data Pembudidaya');

    // Sheet 2: Produksi Per Kecamatan - separated by business type
    const kecDetail: Record<string, {
      pembesaranProduction: number; pembenihanProduction: number;
      value: number; rtp: number; farmer: number; group: number;
    }> = {};
    const groupNamesByKecamatan: Record<string, Set<string>> = {};

    records.forEach(r => {
      if (!kecDetail[r.kecamatan]) {
        kecDetail[r.kecamatan] = {
          pembesaranProduction: 0, pembenihanProduction: 0,
          value: 0, rtp: 0, farmer: 0, group: 0,
        };
        groupNamesByKecamatan[r.kecamatan] = new Set();
      }
      if (r.businessType === 'Pembesaran') {
        kecDetail[r.kecamatan].pembesaranProduction += r.productionQty;
      } else {
        kecDetail[r.kecamatan].pembenihanProduction += r.productionQty;
      }
      kecDetail[r.kecamatan].value += r.productionValue;
      kecDetail[r.kecamatan].rtp += r.rtpCount;
      kecDetail[r.kecamatan].farmer += r.farmerCount;
      // Track unique group names
      if (r.groupName && r.groupName.trim()) {
        groupNamesByKecamatan[r.kecamatan].add(r.groupName.trim().toLowerCase());
      }
    });

    // Set group counts from unique names
    Object.keys(kecDetail).forEach(kec => {
      kecDetail[kec].group = groupNamesByKecamatan[kec]?.size || 0;
    });

    const kecHeaders = ['Kecamatan', 'Pembesaran (Kg)', 'Pembenihan (Ekor)', 'Nilai Produksi (Rp)', 'RTP', 'Pembudidaya', 'Kelompok'];
    const kecRows = Object.entries(kecDetail).map(([kec, d]) => [
      kec,
      Math.round(d.pembesaranProduction * 100) / 100,
      Math.round(d.pembenihanProduction * 100) / 100,
      Math.round(d.value * 100) / 100,
      d.rtp,
      d.farmer,
      d.group,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([kecHeaders, ...kecRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Produksi Per Kecamatan');

    // Sheet 3: Target vs Realisasi - separated by business type
    const targetPembesaran: Record<string, { target: number; realisasi: number }> = {};
    const targetPembenihan: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (r.businessType === 'Pembesaran') {
        if (!targetPembesaran[r.fishType]) targetPembesaran[r.fishType] = { target: 0, realisasi: 0 };
        targetPembesaran[r.fishType].target += r.targetQty;
        targetPembesaran[r.fishType].realisasi += r.productionQty;
      } else {
        if (!targetPembenihan[r.fishType]) targetPembenihan[r.fishType] = { target: 0, realisasi: 0 };
        targetPembenihan[r.fishType].target += r.targetQty;
        targetPembenihan[r.fishType].realisasi += r.productionQty;
      }
    });

    const targetHeaders = ['Jenis Ikan', 'Jenis Usaha', 'Target', 'Realisasi', 'Satuan', 'Persentase (%)'];
    const targetRowsPembesaran = Object.entries(targetPembesaran).map(([fish, d]) => [
      fish, 'Pembesaran',
      Math.round(d.target * 100) / 100,
      Math.round(d.realisasi * 100) / 100,
      'Kg',
      d.target > 0 ? Math.round((d.realisasi / d.target) * 10000) / 100 : 0,
    ]);
    const targetRowsPembenihan = Object.entries(targetPembenihan).map(([fish, d]) => [
      fish, 'Pembenihan',
      Math.round(d.target * 100) / 100,
      Math.round(d.realisasi * 100) / 100,
      'Ekor',
      d.target > 0 ? Math.round((d.realisasi / d.target) * 10000) / 100 : 0,
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([targetHeaders, ...targetRowsPembesaran, ...targetRowsPembenihan]);
    ws3['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Target vs Realisasi');

    // Sheet 4: Trend 5 Tahun - separated by business type (no combined total)
    const trend: Record<number, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      if (!trend[r.year]) {
        trend[r.year] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trend[r.year].pembesaran += r.productionQty;
      } else {
        trend[r.year].pembenihan += r.productionQty;
      }
    });

    const trendHeaders = ['Tahun', 'Pembesaran (Kg)', 'Pembenihan (Ekor)'];
    const trendRows = Object.entries(trend)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, d]) => [
        Number(year),
        Math.round(d.pembesaran * 100) / 100,
        Math.round(d.pembenihan * 100) / 100,
      ]);
    const ws4 = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
    ws4['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Trend 5 Tahun');

    // Sheet 5: RTP & Pembudidaya
    const businessSummary: Record<string, { rtp: number; farmer: number; production: number }> = {};
    const groupNamesByBusinessType: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (!businessSummary[r.businessType]) {
        businessSummary[r.businessType] = { rtp: 0, farmer: 0, production: 0 };
        groupNamesByBusinessType[r.businessType] = new Set();
      }
      businessSummary[r.businessType].rtp += r.rtpCount;
      businessSummary[r.businessType].farmer += r.farmerCount;
      businessSummary[r.businessType].production += r.productionQty;
      if (r.groupName && r.groupName.trim()) {
        groupNamesByBusinessType[r.businessType].add(r.groupName.trim().toLowerCase());
      }
    });

    const businessHeaders = ['Jenis Usaha', 'RTP', 'Pembudidaya', 'Kelompok', 'Produksi', 'Satuan'];
    const businessRows = Object.entries(businessSummary).map(([type, d]) => [
      type,
      d.rtp,
      d.farmer,
      groupNamesByBusinessType[type]?.size || 0,
      Math.round(d.production * 100) / 100,
      type === 'Pembesaran' ? 'Kg' : 'Ekor',
    ]);
    const ws5 = XLSX.utils.aoa_to_sheet([businessHeaders, ...businessRows]);
    ws5['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'RTP & Pembudidaya');

    // Sheet 6: Harga Komoditas
    try {
      const priceRecords = await db.commodityPrice.findMany();
      const { DEFAULT_COMMODITY_PRICES: DEFAULT_PRICES, DEFAULT_PEMBENIHAN_PRICES, FISH_TYPES: FISHES, CONTAINER_TYPES: CONTAINERS } = await import('@/lib/constants');

      // Pembesaran prices section
      const pembesaranHeaders = ['Jenis Ikan', ...CONTAINERS];
      const pembesaranRows = FISHES.map(fish =>
        [fish, ...CONTAINERS.map(ct => {
          const dbPrice = priceRecords.find(p => p.fishType === fish && p.containerType === ct);
          return dbPrice ? dbPrice.price : (DEFAULT_PRICES[fish]?.[ct] ?? 0);
        })]
      );

      // Pembenihan prices section
      const pembenihanHeaders = ['Jenis Ikan', 'Harga per Ekor (Rp)'];
      const pembenihanRows = FISHES.map(fish => {
        const dbPrice = priceRecords.find(p => p.fishType === fish && p.containerType === 'Pembenihan');
        return [fish, dbPrice ? dbPrice.price : (DEFAULT_PEMBENIHAN_PRICES[fish] ?? 0)];
      });

      // Combine both sections with a blank row separator
      const commoditySheetData = [
        ['HARGA PEMBESARAN (Rp/Kg)'],
        pembesaranHeaders,
        ...pembesaranRows,
        [], // blank separator row
        ['HARGA PEMBENIHAN (Rp/Ekor)'],
        pembenihanHeaders,
        ...pembenihanRows,
      ];

      const ws6 = XLSX.utils.aoa_to_sheet(commoditySheetData);

      // Set column widths
      const commodityCols = [
        { wch: 20 }, // Jenis Ikan
        ...CONTAINERS.map(() => ({ wch: 18 })), // Container columns
      ];
      ws6['!cols'] = commodityCols;

      XLSX.utils.book_append_sheet(wb, ws6, 'Harga Komoditas');
    } catch (err) {
      console.warn('Could not add Harga Komoditas sheet:', err);
      // Continue without the commodity prices sheet
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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
