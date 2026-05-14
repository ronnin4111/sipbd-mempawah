import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/fish-farms/filter-options
 *
 * Returns distinct values for all filter fields in a single call.
 * Each field is queried with all OTHER filters applied, but NOT its own filter,
 * so that selecting a kecamatan still shows all kecamatan options but narrows
 * down the desa/fishType/etc options.
 *
 * Query params:
 *   year          - comma-separated years
 *   kecamatan     - comma-separated kecamatan names
 *   desa          - comma-separated desa names
 *   groupName     - comma-separated group names
 *   fishType      - comma-separated fish type names
 *   containerType - comma-separated container type names
 *   businessType  - comma-separated business type names
 *
 * Response:
 *   { years, kecamatan, desa, groupNames, fishTypes, containerTypes, businessTypes }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse all filter params into arrays
    const filters: Record<string, string[]> = {};
    for (const [key, value] of searchParams.entries()) {
      filters[key] = value.split(',').filter(Boolean);
    }

    // Helper: build where clause excluding a specific field
    const buildWhere = (excludeField: string) => {
      const where: Record<string, unknown> = {};

      if (excludeField !== 'year' && filters.year?.length) {
        const years = filters.year.map(Number).filter((n) => !isNaN(n));
        if (years.length > 0) where.year = { in: years };
      }
      if (excludeField !== 'kecamatan' && filters.kecamatan?.length) {
        where.kecamatan = { in: filters.kecamatan };
      }
      if (excludeField !== 'desa' && filters.desa?.length) {
        where.desa = { in: filters.desa };
      }
      if (excludeField !== 'groupName' && filters.groupName?.length) {
        where.groupName = { in: filters.groupName };
      }
      if (excludeField !== 'fishType' && filters.fishType?.length) {
        where.fishType = { in: filters.fishType };
      }
      if (excludeField !== 'containerType' && filters.containerType?.length) {
        where.containerType = { in: filters.containerType };
      }
      if (excludeField !== 'businessType' && filters.businessType?.length) {
        where.businessType = { in: filters.businessType };
      }

      return where;
    };

    // Query all options in parallel, each excluding its own filter
    const [
      yearsResult,
      kecamatanResult,
      desaResult,
      groupNameResult,
      fishTypeResult,
      containerTypeResult,
      businessTypeResult,
    ] = await Promise.all([
      db.fishFarm.findMany({
        where: buildWhere('year'),
        select: { year: true },
        distinct: ['year'],
        orderBy: { year: 'desc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('kecamatan'),
        select: { kecamatan: true },
        distinct: ['kecamatan'],
        orderBy: { kecamatan: 'asc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('desa'),
        select: { desa: true },
        distinct: ['desa'],
        orderBy: { desa: 'asc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('groupName'),
        select: { groupName: true },
        distinct: ['groupName'],
        orderBy: { groupName: 'asc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('fishType'),
        select: { fishType: true },
        distinct: ['fishType'],
        orderBy: { fishType: 'asc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('containerType'),
        select: { containerType: true },
        distinct: ['containerType'],
        orderBy: { containerType: 'asc' },
      }),
      db.fishFarm.findMany({
        where: buildWhere('businessType'),
        select: { businessType: true },
        distinct: ['businessType'],
        orderBy: { businessType: 'asc' },
      }),
    ]);

    return NextResponse.json({
      years: yearsResult.map((r) => r.year),
      kecamatan: kecamatanResult.map((r) => r.kecamatan).filter(Boolean),
      desa: desaResult.map((r) => r.desa).filter(Boolean),
      groupNames: groupNameResult
        .map((r) => r.groupName)
        .filter((n) => n && n.trim() !== ''),
      fishTypes: fishTypeResult.map((r) => r.fishType).filter(Boolean),
      containerTypes: containerTypeResult
        .map((r) => r.containerType)
        .filter(Boolean),
      businessTypes: businessTypeResult
        .map((r) => r.businessType)
        .filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
