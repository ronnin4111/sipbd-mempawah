import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Fetch all matching records for aggregation
    // Using raw data for complex aggregations since Prisma groupBy has limitations
    const records = await db.fishFarm.findMany({ where });

    // Total aggregations
    const totalProduction = records.reduce((sum, r) => sum + r.productionQty, 0);
    const totalRtp = records.reduce((sum, r) => sum + r.rtpCount, 0);
    const totalFarmer = records.reduce((sum, r) => sum + r.farmerCount, 0);
    const totalGroup = records.reduce((sum, r) => sum + r.groupCount, 0);

    // Production by business type
    const pembesaranProduction = records
      .filter(r => r.businessType === 'Pembesaran')
      .reduce((sum, r) => sum + r.productionQty, 0);
    const pembenihanProduction = records
      .filter(r => r.businessType === 'Pembenihan')
      .reduce((sum, r) => sum + r.productionQty, 0);

    // Production by fish type
    const productionByFishType: Record<string, number> = {};
    records.forEach(r => {
      productionByFishType[r.fishType] = (productionByFishType[r.fishType] || 0) + r.productionQty;
    });

    // Production by container type
    const productionByContainer: Record<string, number> = {};
    records.forEach(r => {
      productionByContainer[r.containerType] = (productionByContainer[r.containerType] || 0) + r.productionQty;
    });

    // Production by kecamatan
    const productionByKecamatan: Record<string, number> = {};
    records.forEach(r => {
      productionByKecamatan[r.kecamatan] = (productionByKecamatan[r.kecamatan] || 0) + r.productionQty;
    });

    // Production by year
    const productionByYear: Record<string, number> = {};
    records.forEach(r => {
      const yearKey = String(r.year);
      productionByYear[yearKey] = (productionByYear[yearKey] || 0) + r.productionQty;
    });

    // RTP by business type
    const rtpByBusinessType: Record<string, number> = {};
    records.forEach(r => {
      rtpByBusinessType[r.businessType] = (rtpByBusinessType[r.businessType] || 0) + r.rtpCount;
    });

    // Farmer by business type
    const farmerByBusinessType: Record<string, number> = {};
    records.forEach(r => {
      farmerByBusinessType[r.businessType] = (farmerByBusinessType[r.businessType] || 0) + r.farmerCount;
    });

    // Group by business type
    const groupByBusinessType: Record<string, number> = {};
    records.forEach(r => {
      groupByBusinessType[r.businessType] = (groupByBusinessType[r.businessType] || 0) + r.groupCount;
    });

    // Target vs Realisasi by fish type
    const targetVsRealisasi: Record<string, { target: number; realisasi: number }> = {};
    records.forEach(r => {
      if (!targetVsRealisasi[r.fishType]) {
        targetVsRealisasi[r.fishType] = { target: 0, realisasi: 0 };
      }
      targetVsRealisasi[r.fishType].target += r.targetQty;
      targetVsRealisasi[r.fishType].realisasi += r.productionQty;
    });

    // Trend 5 Year
    const trend5Year: Record<string, { pembesaran: number; pembenihan: number }> = {};
    records.forEach(r => {
      const yearKey = String(r.year);
      if (!trend5Year[yearKey]) {
        trend5Year[yearKey] = { pembesaran: 0, pembenihan: 0 };
      }
      if (r.businessType === 'Pembesaran') {
        trend5Year[yearKey].pembesaran += r.productionQty;
      } else if (r.businessType === 'Pembenihan') {
        trend5Year[yearKey].pembenihan += r.productionQty;
      }
    });

    // Production by kecamatan detail
    const productionByKecamatanDetail: Record<string, { production: number; value: number; rtp: number; farmer: number; group: number }> = {};
    records.forEach(r => {
      if (!productionByKecamatanDetail[r.kecamatan]) {
        productionByKecamatanDetail[r.kecamatan] = { production: 0, value: 0, rtp: 0, farmer: 0, group: 0 };
      }
      productionByKecamatanDetail[r.kecamatan].production += r.productionQty;
      productionByKecamatanDetail[r.kecamatan].value += r.productionValue;
      productionByKecamatanDetail[r.kecamatan].rtp += r.rtpCount;
      productionByKecamatanDetail[r.kecamatan].farmer += r.farmerCount;
      productionByKecamatanDetail[r.kecamatan].group += r.groupCount;
    });

    // Round all float values to 2 decimal places for cleaner output
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      totalProduction: round2(totalProduction),
      totalRtp,
      totalFarmer,
      totalGroup,
      pembesaranProduction: round2(pembesaranProduction),
      pembenihanProduction: round2(pembenihanProduction),
      productionByFishType: Object.fromEntries(
        Object.entries(productionByFishType).map(([k, v]) => [k, round2(v)])
      ),
      productionByContainer: Object.fromEntries(
        Object.entries(productionByContainer).map(([k, v]) => [k, round2(v)])
      ),
      productionByKecamatan: Object.fromEntries(
        Object.entries(productionByKecamatan).map(([k, v]) => [k, round2(v)])
      ),
      productionByYear: Object.fromEntries(
        Object.entries(productionByYear).map(([k, v]) => [k, round2(v)])
      ),
      rtpByBusinessType,
      farmerByBusinessType,
      groupByBusinessType,
      targetVsRealisasi: Object.fromEntries(
        Object.entries(targetVsRealisasi).map(([k, v]) => [k, { target: round2(v.target), realisasi: round2(v.realisasi) }])
      ),
      trend5Year: Object.fromEntries(
        Object.entries(trend5Year).map(([k, v]) => [k, { pembesaran: round2(v.pembesaran), pembenihan: round2(v.pembenihan) }])
      ),
      productionByKecamatanDetail: Object.fromEntries(
        Object.entries(productionByKecamatanDetail).map(([k, v]) => [k, {
          production: round2(v.production),
          value: round2(v.value),
          rtp: v.rtp,
          farmer: v.farmer,
          group: v.group,
        }])
      ),
    });
  } catch (error) {
    console.error('Error fetching fish farm stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fish farm statistics' },
      { status: 500 }
    );
  }
}
