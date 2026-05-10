import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

// Helper to generate farmerId from a database record (fallback for old records without farmerId)
function generateFarmerIdFromRecord(r: { farmerName: string; groupName: string; kecamatan: string; desa: string }): string {
  return generateFarmerId({
    farmerName: r.farmerName || '',
    groupName: r.groupName || '',
    kecamatan: r.kecamatan || '',
    desa: r.desa || '',
  });
}

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
    const now = new Date();
    const calendarYear = now.getFullYear();

    // Determine if year filter is explicitly set
    const yearParam = searchParams.get('year');
    const selectedYears = yearParam
      ? yearParam.split(',').map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b)
      : [];

    // === Default to current year when no year filter is selected ===
    // This ensures tables/charts show current year data by default.
    // Trend data always fetches ALL years regardless.
    const where = buildWhere(searchParams);
    if (!yearParam) {
      where.year = calendarYear;
    }

    const records = await db.fishFarm.findMany({ where });

    // === For trend data, always fetch ALL years (not just current year) ===
    const trendWhere = buildWhere(searchParams);
    // Remove year filter for trend data to show all years
    delete trendWhere.year;
    const trendRecords = await db.fishFarm.findMany({ where: trendWhere });

    const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Build a human-readable period label
    // Examples: "s/d Maret 2026", "Tahun 2024", "2022, 2023 s/d 2024"
    let periodLabel: string;
    const currentMonthName = indonesianMonths[now.getMonth()];

    if (selectedYears.length === 0) {
      // No year filter → current calendar year
      periodLabel = `s/d ${currentMonthName} ${calendarYear}`;
    } else if (selectedYears.length === 1) {
      // Single year selected
      if (selectedYears[0] === calendarYear) {
        periodLabel = `s/d ${currentMonthName} ${calendarYear}`;
      } else {
        periodLabel = `Tahun ${selectedYears[0]}`;
      }
    } else {
      // Multiple years: "2022, 2023 s/d 2024"
      if (selectedYears.length === 2) {
        periodLabel = `${selectedYears[0]} s/d ${selectedYears[1]}`;
      } else {
        const first = selectedYears.slice(0, -1).join(', ');
        const last = selectedYears[selectedYears.length - 1];
        periodLabel = `${first} s/d ${last}`;
      }
    }

    // === Display period records (for dashboard cards) ===
    // When years are selected, use ALL filtered records (already filtered by selected years).
    // When no year filter, use only current calendar year records.
    const currentYearRecords = selectedYears.length > 0
      ? records  // already filtered by buildWhere
      : records.filter(r => r.year === calendarYear);
    const currentYearPembesaranProduction = currentYearRecords
      .filter(r => r.businessType === 'Pembesaran')
      .reduce((sum, r) => sum + r.productionQty, 0);
    const currentYearPembenihanProduction = currentYearRecords
      .filter(r => r.businessType === 'Pembenihan')
      .reduce((sum, r) => sum + r.productionQty, 0);

    // Current year production by fish type
    const currentYearProductionByFishType: Record<string, { pembesaran: number; pembenihan: number }> = {};
    currentYearRecords.forEach(r => {
      if (!currentYearProductionByFishType[r.fishType]) {
        currentYearProductionByFishType[r.fishType] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        currentYearProductionByFishType[r.fishType].pembesaran += r.productionQty;
      } else {
        currentYearProductionByFishType[r.fishType].pembenihan += r.productionQty;
      }
    });

    // Current year unique groups by business type
    const currentYearGroupByBusinessType: Record<string, number> = {};
    const currentYearGroupNamesByBT: Record<string, Set<string>> = {};
    currentYearRecords.forEach(r => {
      if (r.groupName && r.groupName.trim()) {
        const normalized = r.groupName.trim().toLowerCase();
        if (!currentYearGroupNamesByBT[r.businessType]) currentYearGroupNamesByBT[r.businessType] = new Set();
        currentYearGroupNamesByBT[r.businessType].add(normalized);
      }
    });
    Object.entries(currentYearGroupNamesByBT).forEach(([bt, set]) => {
      currentYearGroupByBusinessType[bt] = set.size;
    });

    // Current year farmer/rtp by business type (unique farmerId in current year)
    const currentYearFarmerLatestRecord = new Map<string, typeof records[0]>();
    const currentYearSortedDesc = [...currentYearRecords].sort((a, b) => b.year - a.year);
    for (const r of currentYearSortedDesc) {
      const fid = r.farmerId || generateFarmerIdFromRecord(r);
      if (!currentYearFarmerLatestRecord.has(fid)) {
        currentYearFarmerLatestRecord.set(fid, r);
      }
    }
    const currentYearUniqueFarmerRecords = Array.from(currentYearFarmerLatestRecord.values());
    const currentYearFarmerByBusinessType: Record<string, number> = {};
    const currentYearRtpByBusinessType: Record<string, number> = {};
    currentYearUniqueFarmerRecords.forEach(r => {
      currentYearFarmerByBusinessType[r.businessType] = (currentYearFarmerByBusinessType[r.businessType] || 0) + r.farmerCount;
      currentYearRtpByBusinessType[r.businessType] = (currentYearRtpByBusinessType[r.businessType] || 0) + r.rtpCount;
    });

    // === Production by business type (NOT combined - different units!) ===
    const pembesaranProduction = records
      .filter(r => r.businessType === 'Pembesaran')
      .reduce((sum, r) => sum + r.productionQty, 0);
    const pembenihanProduction = records
      .filter(r => r.businessType === 'Pembenihan')
      .reduce((sum, r) => sum + r.productionQty, 0);

    // === Totals (RTP, Farmer) ===
    // Use farmerId to count unique farmers across all years.
    // For farmer/rtp counts, take the value from the LATEST year for each unique farmerId.
    const allYears = [...new Set(records.map(r => r.year))].sort((a, b) => b - a);
    const latestYear = allYears.length > 0 ? allYears[0] : null;

    // Build a map: farmerId → record from latest year
    const farmerLatestRecord = new Map<string, typeof records[0]>();
    // Sort records by year desc so latest year comes first
    const sortedByYearDesc = [...records].sort((a, b) => b.year - a.year);
    for (const r of sortedByYearDesc) {
      const fid = r.farmerId || generateFarmerIdFromRecord(r);
      if (!farmerLatestRecord.has(fid)) {
        farmerLatestRecord.set(fid, r);
      }
    }

    // Sum farmer/rtp counts from unique farmers only
    const uniqueFarmerRecords = Array.from(farmerLatestRecord.values());
    const totalRtp = uniqueFarmerRecords.reduce((sum, r) => sum + r.rtpCount, 0);
    const totalFarmer = uniqueFarmerRecords.reduce((sum, r) => sum + r.farmerCount, 0);

    // === KUSUKA count ===
    // KUSUKA berisi nomor 16 digit (seperti NIK), count unique across all years
    const kusukaSet = new Set<string>();
    uniqueFarmerRecords.forEach(r => {
      const k = String(r.kusuka || '').trim();
      if (/^\d{16}$/.test(k)) kusukaSet.add(k);
    });
    const totalKusuka = kusukaSet.size;

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

    // === RTP by business type (use unique farmerId records to avoid double-counting) ===
    const rtpByBusinessType: Record<string, number> = {};
    uniqueFarmerRecords.forEach(r => {
      rtpByBusinessType[r.businessType] = (rtpByBusinessType[r.businessType] || 0) + r.rtpCount;
    });

    // === Farmer by business type (use unique farmerId records to avoid double-counting) ===
    const farmerByBusinessType: Record<string, number> = {};
    uniqueFarmerRecords.forEach(r => {
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

    // === Trend 5 Year (uses ALL years from trendRecords) ===
    const trend5Year: Record<string, { pembesaran: number; pembenihan: number }> = {};
    trendRecords.forEach(r => {
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

    // === Trend by Fish Type per Year (uses ALL years from trendRecords) ===
    const trendByFishType: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    trendRecords.forEach(r => {
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

    // === Trend by Kecamatan per Year (uses ALL years from trendRecords) ===
    const trendByKecamatan: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    trendRecords.forEach(r => {
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

    // === Trend by Container Type per Year (uses ALL years from trendRecords) ===
    const trendByContainer: Record<string, Record<string, { pembesaran: number; pembenihan: number }>> = {};
    trendRecords.forEach(r => {
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
    // Production is summed across years, but farmer/rtp counts use unique farmerId records
    const productionByKecamatanDetail: Record<string, {
      pembesaranProduction: number;
      pembenihanProduction: number;
      value: number;
      rtp: number;
      farmer: number;
      group: number;
      pembesaranFarmer: number;
      pembenihanFarmer: number;
      pembesaranRtp: number;
      pembenihanRtp: number;
      pembesaranGroup: number;
      pembenihanGroup: number;
    }> = {};
    records.forEach(r => {
      if (!productionByKecamatanDetail[r.kecamatan]) {
        productionByKecamatanDetail[r.kecamatan] = {
          pembesaranProduction: 0, pembenihanProduction: 0,
          value: 0, rtp: 0, farmer: 0, group: 0,
          pembesaranFarmer: 0, pembenihanFarmer: 0,
          pembesaranRtp: 0, pembenihanRtp: 0,
          pembesaranGroup: 0, pembenihanGroup: 0,
        };
      }
      if (r.businessType === 'Pembesaran') {
        productionByKecamatanDetail[r.kecamatan].pembesaranProduction += r.productionQty;
      } else {
        productionByKecamatanDetail[r.kecamatan].pembenihanProduction += r.productionQty;
      }
      productionByKecamatanDetail[r.kecamatan].value += r.productionValue;
    });
    // Calculate farmer/rtp from unique farmer records only (avoid double-counting)
    uniqueFarmerRecords.forEach(r => {
      if (productionByKecamatanDetail[r.kecamatan]) {
        productionByKecamatanDetail[r.kecamatan].rtp += r.rtpCount;
        productionByKecamatanDetail[r.kecamatan].farmer += r.farmerCount;
        // Split by business type
        if (r.businessType === 'Pembesaran') {
          productionByKecamatanDetail[r.kecamatan].pembesaranFarmer += r.farmerCount;
          productionByKecamatanDetail[r.kecamatan].pembesaranRtp += r.rtpCount;
        } else {
          productionByKecamatanDetail[r.kecamatan].pembenihanFarmer += r.farmerCount;
          productionByKecamatanDetail[r.kecamatan].pembenihanRtp += r.rtpCount;
        }
      }
    });

    // Set group counts using unique group names (split by business type)
    const groupNamesByKecamatanBusinessType: Record<string, Record<string, Set<string>>> = {};
    records.forEach(r => {
      if (r.groupName && r.groupName.trim()) {
        const normalized = r.groupName.trim().toLowerCase();
        if (!groupNamesByKecamatanBusinessType[r.kecamatan]) {
          groupNamesByKecamatanBusinessType[r.kecamatan] = {};
        }
        if (!groupNamesByKecamatanBusinessType[r.kecamatan][r.businessType]) {
          groupNamesByKecamatanBusinessType[r.kecamatan][r.businessType] = new Set();
        }
        groupNamesByKecamatanBusinessType[r.kecamatan][r.businessType].add(normalized);
      }
    });
    Object.keys(productionByKecamatanDetail).forEach(kec => {
      productionByKecamatanDetail[kec].group = groupNamesByKecamatan[kec]?.size || 0;
      productionByKecamatanDetail[kec].pembesaranGroup = groupNamesByKecamatanBusinessType[kec]?.['Pembesaran']?.size || 0;
      productionByKecamatanDetail[kec].pembenihanGroup = groupNamesByKecamatanBusinessType[kec]?.['Pembenihan']?.size || 0;
    });

    // === Production by Fish Type detail (with value, rtp, farmer, group) ===
    // Production is summed across years, but farmer/rtp counts use unique farmerId records
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
      if (r.groupName && r.groupName.trim()) {
        if (!groupNamesByFishType[r.fishType]) groupNamesByFishType[r.fishType] = new Set();
        groupNamesByFishType[r.fishType].add(r.groupName.trim().toLowerCase());
      }
    });
    // Calculate farmer/rtp from unique farmer records only (avoid double-counting)
    uniqueFarmerRecords.forEach(r => {
      if (productionByFishTypeDetail[r.fishType]) {
        productionByFishTypeDetail[r.fishType].rtp += r.rtpCount;
        productionByFishTypeDetail[r.fishType].farmer += r.farmerCount;
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
      latestYear,  // Add this so frontend knows which year farmer counts come from
      rtpByBusinessType,
      farmerByBusinessType,
      groupByBusinessType,
      // Display period data for dashboard cards
      currentYear: selectedYears.length > 0 ? Math.max(...selectedYears) : calendarYear,
      periodLabel,
      currentYearPembesaranProduction: round2(currentYearPembesaranProduction),
      currentYearPembenihanProduction: round2(currentYearPembenihanProduction),
      currentYearProductionByFishType: Object.fromEntries(
        Object.entries(currentYearProductionByFishType).map(([k, v]) => [k, {
          pembesaran: round2(v.pembesaran),
          pembenihan: round2(v.pembenihan),
        }])
      ),
      currentYearGroupByBusinessType,
      currentYearFarmerByBusinessType,
      currentYearRtpByBusinessType,
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
          pembesaranFarmer: v.pembesaranFarmer,
          pembenihanFarmer: v.pembenihanFarmer,
          pembesaranRtp: v.pembesaranRtp,
          pembenihanRtp: v.pembenihanRtp,
          pembesaranGroup: v.pembesaranGroup,
          pembenihanGroup: v.pembenihanGroup,
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
