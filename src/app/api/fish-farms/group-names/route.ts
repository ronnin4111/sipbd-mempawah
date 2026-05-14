import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/fish-farms/group-names
 *
 * Returns distinct group names from the database, optionally filtered by
 * other filter params (kecamatan, desa, fishType, containerType, businessType, year).
 * This ensures the kelompok dropdown list is always dynamic and contextual.
 *
 * Query params:
 *   year          - comma-separated years
 *   kecamatan     - comma-separated kecamatan names
 *   desa          - comma-separated desa names
 *   fishType      - comma-separated fish type names
 *   containerType - comma-separated container type names
 *   businessType  - comma-separated business type names
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build where clause from filter params (same pattern as other routes)
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

    // Fetch distinct group names matching the filters
    const groups = await db.fishFarm.findMany({
      where,
      select: { groupName: true },
      distinct: ['groupName'],
      orderBy: { groupName: 'asc' },
    });

    // Filter out empty/null group names and return
    const groupNames = groups
      .map((g) => g.groupName)
      .filter((name) => name && name.trim() !== '');

    return NextResponse.json({ groupNames });
  } catch (error) {
    console.error('Error fetching group names:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group names' },
      { status: 500 }
    );
  }
}
