import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Case-insensitive contains filter
const ciContains = (value: string) => {
  const isPostgres = process.env.DATABASE_URL?.includes('postgres');
  return isPostgres
    ? { contains: value, mode: 'insensitive' as const }
    : { contains: value };
};

// Helper to build the same filter as the main route
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
      { kecamatan: ciContains(searchParam) },
      { desa: ciContains(searchParam) },
      { fishType: ciContains(searchParam) },
      { containerType: ciContains(searchParam) },
      { farmerName: ciContains(searchParam) },
      { groupName: ciContains(searchParam) },
    ];
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildWhere(searchParams);

    const records = await db.fishFarm.findMany({ where });

    // === Production by business type (NOT combined - different units!) ===
    const pembesaranProduction = records
      .filter(r => r.businessType === 'Pembesaran')
      .reduce((sum, r) => sum + r.productionQty, 0);
    const pembenihanProduction = records
      .filter(r => r.businessType === 'Pembenihan')
      .reduce((sum, r) => sum + r.productionQty, 0);

    // === Totals (RTP, Farmer - same units, can be combined) ===
    const totalRtp = records.reduce((sum, r) => sum + r.rtpCount, 0);
    const totalFarmer = records.reduce((sum, r) => sum + r.farmerCount, 0);

    // === KUSUKA count ===
    // KUSUKA berisi nomor 16 digit (seperti NIK), jika berisi 16 digit maka terhitung 1 kartu
    const totalKusuka = records.filter(r => /^\d{16}$/.test(String(r.kusuka || '').trim())).length;

    // === Total Group: count UNIQUE group names (case-insensitive) ===
    const groupNamesGlobal = new Set<string>();
    const groupNamesByBusinessType: Record<string, Set<string>> = {};
    const groupNamesByKecamatan: Record<string, Set<string>> = {};

    records.forEach(r => {
      if (r.groupName && r.groupName.trim()) {
        const normalized = r.groupName.trim().toLowerCase();
        groupNamesGlobal.add(normalized);

        if (!groupNamesByBusinessType[r.businessType]) {
          groupNamesByBusinessType[r.businessType] = new Set();
        }
        groupNamesByBusinessType[r.businessType].add(normalized);

        if (!groupNamesByKecamatan[r.kecamatan]) {
          groupNamesByKecamatan[r.kecamatan] = new Set();
        }
        groupNamesByKecamatan[r.kecamatan].add(normalized);
      }
    });

    const totalGroup = groupNamesGlobal.size;
    const groupByBusinessType: Record<string, number> = {};
    Object.entries(groupNamesByBusinessType).forEach(([type, set]) => {
      groupByBusinessType[type] = set.size;
    });

    // === Production by fish type - separated by business type ===
    const productionByFishType: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      if (!productionByFishType[r.fishType]) {
        productionByFishType[r.fishType] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByFishType[r.fishType].pembesaran += r.productionQty;
      } else {
        productionByFishType[r.fishType].pembenihan += r.productionQty;
      }
    });

    // === Production by container type - separated by business type ===
    const productionByContainer: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      if (!productionByContainer[r.containerType]) {
        productionByContainer[r.containerType] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByContainer[r.containerType].pembesaran += r.productionQty;
      } else {
        productionByContainer[r.containerType].pembenihan += r.productionQty;
      }
    });

    // === Production by kecamatan - separated by business type ===
    const productionByKecamatan: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      if (!productionByKecamatan[r.kecamatan]) {
        productionByKecamatan[r.kecamatan] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByKecamatan[r.kecamatan].pembesaran += r.productionQty;
      } else {
        productionByKecamatan[r.kecamatan].pembenihan += r.productionQty;
      }
    });

    // === Production by year ===
    const productionByYear: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      const yearKey = String(r.year);
      if (!productionByYear[yearKey]) {
        productionByYear[yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByYear[yearKey].pembesaran += r.productionQty;
      } else {
        productionByYear[yearKey].pembenihan += r.productionQty;
      }
    });

    // === RTP by business type ===
    const rtpByBusinessType: Record<string, number> = {};
    records.forEach(r => {
      rtpByBusinessType[r.businessType] = (rtpByBusinessType[r.businessType] || 0) + r.rtpCount;
    });

    // === Farmer by business type ===
    const farmerByBusinessType: Record<string, number> = {};
    records.forEach(r => {
      farmerByBusinessType[r.businessType] = (farmerByBusinessType[r.businessType] || 0) + r.farmerCount;
    });

    // === Target vs Realisasi - separated by business type ===
    const targetVsRealisasiPembesaran: Record<string, { target: number; realisasi: number }> = {};
    const targetVsRealisasiPembenihan: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (r.businessType === 'Pembesaran') {
        if (!targetVsRealisasiPembesaran[r.fishType]) {
          targetVsRealisasiPembesaran[r.fishType] = { target: 0, realisasi: 0 };
        }
        targetVsRealisasiPembesaran[r.fishType].target += r.targetQty;
        targetVsRealisasiPembesaran[r.fishType].realisasi += r.productionQty;
      } else {
        if (!targetVsRealisasiPembenihan[r.fishType]) {
          targetVsRealisasiPembenihan[r.fishType] = { target: 0, realisasi: 0 };
        }
        targetVsRealisasiPembenihan[r.fishType].target += r.targetQty;
        targetVsRealisasiPembenihan[r.fishType].realisasi += r.productionQty;
      }
    });

    // === Trend 5 Year ===
    const trend5Year: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      const yearKey = String(r.year);
      if (!trend5Year[yearKey]) {
        trend5Year[yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trend5Year[yearKey].pembesaran += r.productionQty;
      } else {
        trend5Year[yearKey].pembenihan += r.productionQty;
      }
    });

    // === Trend by Fish Type per Year ===
    const trendByFishType: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    records.forEach(r => {
      if (!trendByFishType[r.fishType]) trendByFishType[r.fishType] = {};
      const yearKey = String(r.year);
      if (!trendByFishType[r.fishType][yearKey]) {
        trendByFishType[r.fishType][yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trendByFishType[r.fishType][yearKey].pembesaran += r.productionQty;
      } else {
        trendByFishType[r.fishType][yearKey].pembenihan += r.productionQty;
      }
    });

    // === Trend by Kecamatan per Year ===
    const trendByKecamatan: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    records.forEach(r => {
      if (!trendByKecamatan[r.kecamatan]) trendByKecamatan[r.kecamatan] = {};
      const yearKey = String(r.year);
      if (!trendByKecamatan[r.kecamatan][yearKey]) {
        trendByKecamatan[r.kecamatan][yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trendByKecamatan[r.kecamatan][yearKey].pembesaran += r.productionQty;
      } else {
        trendByKecamatan[r.kecamatan][yearKey].pembenihan += r.productionQty;
      }
    });

    // === Trend by Container Type per Year ===
    const trendByContainer: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    records.forEach(r => {
      if (!trendByContainer[r.containerType]) trendByContainer[r.containerType] = {};
      const yearKey = String(r.year);
      if (!trendByContainer[r.containerType][yearKey]) {
        trendByContainer[r.containerType][yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trendByContainer[r.containerType][yearKey].pembesaran += r.productionQty;
      } else {
        trendByContainer[r.containerType][yearKey].pembenihan += r.productionQty;
      }
    });

    // === Cross-tab: Kecamatan × FishType ===
    const productionByKecamatanByFishType: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    records.forEach(r => {
      if (!productionByKecamatanByFishType[r.kecamatan]) productionByKecamatanByFishType[r.kecamatan] = {};
      if (!productionByKecamatanByFishType[r.kecamatan][r.fishType]) {
        productionByKecamatanByFishType[r.kecamatan][r.fishType] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByKecamatanByFishType[r.kecamatan][r.fishType].pembesaran += r.productionQty;
      } else {
        productionByKecamatanByFishType[r.kecamatan][r.fishType].pembenihan += r.productionQty;
      }
    });

    // === Cross-tab: Kecamatan × ContainerType ===
    const productionByKecamatanByContainer: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    records.forEach(r => {
      if (!productionByKecamatanByContainer[r.kecamatan]) productionByKecamatanByContainer[r.kecamatan] = {};
      if (!productionByKecamatanByContainer[r.kecamatan][r.containerType]) {
        productionByKecamatanByContainer[r.kecamatan][r.containerType] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        productionByKecamatanByContainer[r.kecamatan][r.containerType].pembesaran += r.productionQty;
      } else {
        productionByKecamatanByContainer[r.kecamatan][r.containerType].pembenihan += r.productionQty;
      }
    });

    // === Production by kecamatan detail - separated by business type ===
    const productionByKecamatanDetail: Record<string, {
      pembesaranProduction: number;
      pembenihanProduction: number;
      value: number;
      rtp: number;
      farmer: number;
      group: number;
    }> = {};
    records.forEach(r => {
      if (!productionByKecamatanDetail[r.kecamatan]) {
        productionByKecamatanDetail[r.kecamatan] = {
          pembesaranProduction: 0, pembenihanProduction: 0,
          value: 0, rtp: 0, farmer: 0, group: 0,
        };
      }
      if (r.businessType === 'Pembesaran') {
        productionByKecamatanDetail[r.kecamatan].pembesaranProduction += r.productionQty;
      } else {
        productionByKecamatanDetail[r.kecamatan].pembenihanProduction += r.productionQty;
      }
      productionByKecamatanDetail[r.kecamatan].value += r.productionValue;
      productionByKecamatanDetail[r.kecamatan].rtp += r.rtpCount;
      productionByKecamatanDetail[r.kecamatan].farmer += r.farmerCount;
      // Group: use unique group names per kecamatan
    });

    // Set group counts using unique group names
    Object.keys(productionByKecamatanDetail).forEach(kec => {
      productionByKecamatanDetail[kec].group = groupNamesByKecamatan[kec]?.size || 0;
    });

    // === Production by Fish Type detail (with value, rtp, farmer, group) ===
    const productionByFishTypeDetail: Record<string, {
      pembesaranProduction: number;
      pembenihanProduction: number;
      value: number;
      rtp: number;
      farmer: number;
      group: number;
    }> = {};
    const groupNamesByFishType: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (!productionByFishTypeDetail[r.fishType]) {
        productionByFishTypeDetail[r.fishType] = {
          pembesaranProduction: 0, pembenihanProduction: 0,
          value: 0, rtp: 0, farmer: 0, group: 0,
        };
      }
      if (r.businessType === 'Pembesaran') {
        productionByFishTypeDetail[r.fishType].pembesaranProduction += r.productionQty;
      } else {
        productionByFishTypeDetail[r.fishType].pembenihanProduction += r.productionQty;
      }
      productionByFishTypeDetail[r.fishType].value += r.productionValue;
      productionByFishTypeDetail[r.fishType].rtp += r.rtpCount;
      productionByFishTypeDetail[r.fishType].farmer += r.farmerCount;
      if (r.groupName && r.groupName.trim()) {
        if (!groupNamesByFishType[r.fishType]) groupNamesByFishType[r.fishType] = new Set();
        groupNamesByFishType[r.fishType].add(r.groupName.trim().toLowerCase());
      }
    });
    Object.keys(productionByFishTypeDetail).forEach(ft => {
      productionByFishTypeDetail[ft].group = groupNamesByFishType[ft]?.size || 0;
    });

    // Round all float values to 2 decimal places
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // === Commodity Prices (with try/catch - may not exist yet) ===
    let commodityPrices: Record<string, Record<string, number>> | null = null;
    try {
      const priceRecords = await db.commodityPrice.findMany();
      const { DEFAULT_COMMODITY_PRICES: DEFAULT_PRICES, DEFAULT_PEMBENIHAN_PRICES, FISH_TYPES: FISHES, CONTAINER_TYPES: CONTAINERS } = await import('@/lib/constants');
      commodityPrices = {};
      for (const fish of FISHES) {
        commodityPrices[fish] = {};
        for (const container of CONTAINERS) {
          const dbPrice = priceRecords.find(p => p.fishType === fish && p.containerType === container);
          commodityPrices[fish][container] = dbPrice ? dbPrice.price : (DEFAULT_PRICES[fish]?.[container] ?? 0);
        }
      }
      // Add pembenihan prices as a special entry
      const pembenihanPrices: Record<string, number> = {};
      for (const fish of FISHES) {
        const dbPrice = priceRecords.find(p => p.fishType === fish && p.containerType === 'Pembenihan');
        pembenihanPrices[fish] = dbPrice ? dbPrice.price : (DEFAULT_PEMBENIHAN_PRICES[fish] ?? 0);
      }
      (commodityPrices as Record<string, Record<string, number>>)['Pembenihan'] = pembenihanPrices as unknown as Record<string, number> as Record<string, number>;
    } catch (err) {
      console.warn('CommodityPrice table not available, skipping...', err);
      commodityPrices = null;
    }

    return NextResponse.json({
      pembesaranProduction: round2(pembesaranProduction),
      pembenihanProduction: round2(pembenihanProduction),
      totalRtp,
      totalFarmer,
      totalGroup,
      rtpByBusinessType,
      farmerByBusinessType,
      groupByBusinessType,
      productionByFishType: Object.fromEntries(
        Object.entries(productionByFishType).map(([k, v]) => [k, {
          pembesaran: round2(v.pembesaran),
          pembenihan: round2(v.pembenihan),
        }])
      ),
      productionByContainer: Object.fromEntries(
        Object.entries(productionByContainer).map(([k, v]) => [k, {
          pembesaran: round2(v.pembesaran),
          pembenihan: round2(v.pembenihan),
        }])
      ),
      productionByKecamatan: Object.fromEntries(
        Object.entries(productionByKecamatan).map(([k, v]) => [k, {
          pembesaran: round2(v.pembesaran),
          pembenihan: round2(v.pembenihan),
        }])
      ),
      productionByYear: Object.fromEntries(
        Object.entries(productionByYear).map(([k, v]) => [k, {
          pembesaran: round2(v.pembesaran),
          pembenihan: round2(v.pembenihan),
        }])
      ),
      targetVsRealisasiPembesaran: Object.fromEntries(
        Object.entries(targetVsRealisasiPembesaran).map(([k, v]) => [k, { target: round2(v.target), realisasi: round2(v.realisasi) }])
      ),
      targetVsRealisasiPembenihan: Object.fromEntries(
        Object.entries(targetVsRealisasiPembenihan).map(([k, v]) => [k, { target: round2(v.target), realisasi: round2(v.realisasi) }])
      ),
      trend5Year: Object.fromEntries(
        Object.entries(trend5Year).map(([k, v]) => [k, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
      ),
      productionByKecamatanDetail: Object.fromEntries(
        Object.entries(productionByKecamatanDetail).map(([k, v]) => [k, {
          pembesaranProduction: round2(v.pembesaranProduction),
          pembenihanProduction: round2(v.pembenihanProduction),
          value: round2(v.value),
          rtp: v.rtp,
          farmer: v.farmer,
          group: v.group,
        }])
      ),
      productionByFishTypeDetail: Object.fromEntries(
        Object.entries(productionByFishTypeDetail).map(([k, v]) => [k, {
          pembesaranProduction: round2(v.pembesaranProduction),
          pembenihanProduction: round2(v.pembenihanProduction),
          value: round2(v.value),
          rtp: v.rtp,
          farmer: v.farmer,
          group: v.group,
        }])
      ),
      trendByFishType: Object.fromEntries(
        Object.entries(trendByFishType).map(([fishType, years]) => [fishType, Object.fromEntries(
          Object.entries(years).map(([y, v]) => [y, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
        )])
      ),
      trendByKecamatan: Object.fromEntries(
        Object.entries(trendByKecamatan).map(([kec, years]) => [kec, Object.fromEntries(
          Object.entries(years).map(([y, v]) => [y, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
        )])
      ),
      trendByContainer: Object.fromEntries(
        Object.entries(trendByContainer).map(([cont, years]) => [cont, Object.fromEntries(
          Object.entries(years).map(([y, v]) => [y, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
        )])
      ),
      productionByKecamatanByFishType: Object.fromEntries(
        Object.entries(productionByKecamatanByFishType).map(([kec, fishTypes]) => [kec, Object.fromEntries(
          Object.entries(fishTypes).map(([ft, v]) => [ft, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
        )])
      ),
      productionByKecamatanByContainer: Object.fromEntries(
        Object.entries(productionByKecamatanByContainer).map(([kec, containers]) => [kec, Object.fromEntries(
          Object.entries(containers).map(([ct, v]) => [ct, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
        )])
      ),
      commodityPrices,
      totalKusuka,
    });
  } catch (error) {
    console.error('Error fetching fish farm stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fish farm statistics' },
      { status: 500 }
    );
  }
}
