import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 1), 100);

    const where: Record<string, unknown> = {};

    if (search) {
      const q = search.toLowerCase();
      where.OR = [
        { nama: { contains: q } },
        { kecamatan: { contains: q } },
        { kelDesa: { contains: q } },
        { namaKelompok: { contains: q } },
        { noKusuka: { contains: q } },
        { alamat: { contains: q } },
      ];
    }

    // ── [Q-5] + [A-14] fix: replace full-table load + 5 filter passes + 4 groupBy
    // passes + JS sort + JS slice with a single Promise.all of cheap DB aggregations
    // and a paginated findMany with select. All field names preserved for the FE. ──
    const skip = (page - 1) * pageSize;

    const [
      total,
      statusGroups,
      kecGroups,
      profesiGroups,
      bentukGroups,
      kelompokPairs,
      withKelompok,
      recent,
      noKusukaRows,
    ] = await Promise.all([
      // 1. Total count (replaces registrations.length)
      db.kusukaRegistration.count({ where }),
      // 2. Status distribution (replaces 3 .filter().length passes)
      db.kusukaRegistration.groupBy({ by: ['statusKusuka'], where, _count: { _all: true } }),
      // 3. By kecamatan (replaces 1 for...of + sort + map)
      db.kusukaRegistration.groupBy({ by: ['kecamatan'], where, _count: { _all: true } }),
      // 4. By profesiUtama
      db.kusukaRegistration.groupBy({ by: ['profesiUtama'], where, _count: { _all: true } }),
      // 5. By bentukUsaha
      db.kusukaRegistration.groupBy({ by: ['bentukUsaha'], where, _count: { _all: true } }),
      // 6. Kelompok × kecamatan pairs (used to rebuild kelompokList with CSV kecamatan)
      db.kusukaRegistration.groupBy({
        by: ['namaKelompok', 'kecamatan'],
        where: { ...where, namaKelompok: { not: '' } },
        _count: { _all: true },
      }),
      // 7. Count of registrations that have a non-empty kelompok
      db.kusukaRegistration.count({ where: { ...where, namaKelompok: { not: '' } } }),
      // 8. Paginated recent list (replaces JS sort + slice) — DB-side ORDER BY + LIMIT
      db.kusukaRegistration.findMany({
        where,
        orderBy: { tglDibuat: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          nama: true,
          kecamatan: true,
          kelDesa: true,
          namaKelompok: true,
          bentukUsaha: true,
          profesiUtama: true,
          noKusuka: true,
          statusKusuka: true,
          alamat: true,
          tglDibuat: true,
        },
      }),
      // 9. Just the noKusuka column for 16-digit card validation
      //    (SQLite can't regex in WHERE, but loading 1 column << loading all 19)
      db.kusukaRegistration.findMany({ where, select: { noKusuka: true } }),
    ]);

    // --- Status counts: extract Valid / Draf / Submit buckets (preserve original) ---
    let validStatus = 0;
    let drafStatus = 0;
    let submitStatus = 0;
    for (const g of statusGroups) {
      if (g.statusKusuka === 'Valid') validStatus = g._count._all;
      else if (g.statusKusuka === 'Draf') drafStatus = g._count._all;
      else if (g.statusKusuka === 'Submit') submitStatus = g._count._all;
    }

    // --- Valid 16-digit KUSUKA card count (JS regex over a 1-column projection) ---
    const validKusukaCard = noKusukaRows.filter(r =>
      /^\d{16}$/.test((r.noKusuka || '').trim())
    ).length;

    // --- By Kecamatan (empty string -> '-' to match original fallback) ---
    const byKecamatan = kecGroups
      .map(g => ({ kecamatan: g.kecamatan || '-', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    // --- By Profesi ---
    const byProfesi = profesiGroups
      .map(g => ({ profesi: g.profesiUtama || '-', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    // --- By Bentuk Usaha ---
    const byBentukUsaha = bentukGroups
      .map(g => ({ bentuk: g.bentukUsaha || '-', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    // --- Kelompok list: aggregate (namaKelompok × kecamatan) pairs back to
    //     per-kelompok entries with a CSV of unique kecamatan, then take top 50. ---
    const kelompokMap = new Map<string, { nama: string; kecamatan: Set<string>; count: number }>();
    for (const p of kelompokPairs) {
      const k = p.namaKelompok;
      if (!kelompokMap.has(k)) {
        kelompokMap.set(k, { nama: k, kecamatan: new Set(), count: 0 });
      }
      const entry = kelompokMap.get(k)!;
      entry.count += p._count._all;
      if (p.kecamatan) entry.kecamatan.add(p.kecamatan);
    }
    const kelompokList = [...kelompokMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(k => ({ nama: k.nama, kecamatan: [...k.kecamatan].join(', '), count: k.count }));

    // Recent registrations are already paginated + projected by Prisma
    const paginatedRecent = recent;

    const totalCount = total;
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      total,
      validStatus,
      drafStatus,
      submitStatus,
      validKusukaCard,
      withKelompok,
      withoutKelompok: total - withKelompok,
      byKecamatan,
      byProfesi,
      byBentukUsaha,
      kelompokList,
      recent: paginatedRecent,
      totalKelompok: kelompokMap.size,
      // Pagination info
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error('KUSUKA Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KUSUKA stats' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
