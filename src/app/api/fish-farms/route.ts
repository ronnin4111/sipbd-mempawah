import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const yearParam = searchParams.get('year');
    const kecamatanParam = searchParams.get('kecamatan');
    const desaParam = searchParams.get('desa');
    const fishTypeParam = searchParams.get('fishType');
    const containerTypeParam = searchParams.get('containerType');
    const businessTypeParam = searchParams.get('businessType');
    const searchParam = searchParams.get('search');
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (yearParam) {
      const years = yearParam.split(',').map(Number).filter(n => !isNaN(n));
      if (years.length > 0) {
        where.year = { in: years };
      }
    }

    if (kecamatanParam) {
      const kecamatanList = kecamatanParam.split(',').filter(Boolean);
      if (kecamatanList.length > 0) {
        where.kecamatan = { in: kecamatanList };
      }
    }

    if (desaParam) {
      const desaList = desaParam.split(',').filter(Boolean);
      if (desaList.length > 0) {
        where.desa = { in: desaList };
      }
    }

    if (fishTypeParam) {
      const fishTypeList = fishTypeParam.split(',').filter(Boolean);
      if (fishTypeList.length > 0) {
        where.fishType = { in: fishTypeList };
      }
    }

    if (containerTypeParam) {
      const containerTypeList = containerTypeParam.split(',').filter(Boolean);
      if (containerTypeList.length > 0) {
        where.containerType = { in: containerTypeList };
      }
    }

    if (businessTypeParam) {
      const businessTypeList = businessTypeParam.split(',').filter(Boolean);
      if (businessTypeList.length > 0) {
        where.businessType = { in: businessTypeList };
      }
    }

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

    // Pagination
    const page = Math.max(1, parseInt(pageParam || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam || '20', 10)));
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      db.fishFarm.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { kecamatan: 'asc' }, { desa: 'asc' }],
      }),
      db.fishFarm.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching fish farms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fish farm data' },
      { status: 500 }
    );
  }
}
