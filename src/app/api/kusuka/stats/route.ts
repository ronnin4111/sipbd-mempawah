import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

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

    const registrations = await db.kusukaRegistration.findMany({ where });

    // Summary stats
    const total = registrations.length;
    const validStatus = registrations.filter(r => r.statusKusuka === 'Valid').length;
    const drafStatus = registrations.filter(r => r.statusKusuka === 'Draf').length;
    const submitStatus = registrations.filter(r => r.statusKusuka === 'Submit').length;
    const validKusukaCard = registrations.filter(r => /^\d{16}$/.test((r.noKusuka || '').trim())).length;
    const withKelompok = registrations.filter(r => r.namaKelompok && r.namaKelompok.trim() !== '').length;

    // Count by kecamatan
    const kecCount = new Map<string, number>();
    for (const r of registrations) {
      const kec = r.kecamatan || '-';
      kecCount.set(kec, (kecCount.get(kec) || 0) + 1);
    }
    const byKecamatan = [...kecCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([kec, count]) => ({ kecamatan: kec, count }));

    // Count by profesiUtama
    const profesiCount = new Map<string, number>();
    for (const r of registrations) {
      const p = r.profesiUtama || '-';
      profesiCount.set(p, (profesiCount.get(p) || 0) + 1);
    }
    const byProfesi = [...profesiCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([profesi, count]) => ({ profesi, count }));

    // Count by bentukUsaha
    const bentukCount = new Map<string, number>();
    for (const r of registrations) {
      const b = r.bentukUsaha || '-';
      bentukCount.set(b, (bentukCount.get(b) || 0) + 1);
    }
    const byBentukUsaha = [...bentukCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([bentuk, count]) => ({ bentuk, count }));

    // Unique kelompok with member counts
    const kelompokMap = new Map<string, { nama: string; kecamatan: Set<string>; count: number }>();
    for (const r of registrations) {
      if (r.namaKelompok && r.namaKelompok.trim()) {
        const k = r.namaKelompok.trim();
        if (!kelompokMap.has(k)) {
          kelompokMap.set(k, { nama: k, kecamatan: new Set(), count: 0 });
        }
        kelompokMap.get(k)!.count++;
        kelompokMap.get(k)!.kecamatan.add(r.kecamatan);
      }
    }
    const kelompokList = [...kelompokMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(k => ({ nama: k.nama, kecamatan: [...k.kecamatan].join(', '), count: k.count }));

    // Recent registrations
    const recent = registrations
      .sort((a, b) => {
        const dateA = a.tglDibuat ? new Date(a.tglDibuat).getTime() : 0;
        const dateB = b.tglDibuat ? new Date(b.tglDibuat).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        nama: r.nama,
        kecamatan: r.kecamatan,
        kelDesa: r.kelDesa,
        namaKelompok: r.namaKelompok,
        bentukUsaha: r.bentukUsaha,
        profesiUtama: r.profesiUtama,
        noKusuka: r.noKusuka,
        statusKusuka: r.statusKusuka,
        alamat: r.alamat,
        tglDibuat: r.tglDibuat,
      }));

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
      recent,
      totalKelompok: kelompokMap.size,
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
