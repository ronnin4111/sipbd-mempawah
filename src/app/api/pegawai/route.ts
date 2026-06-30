import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

// GET /api/pegawai - List all pegawai
export async function GET() {
  try {
    await ensureTablesExist();
    const data = await db.pegawai.findMany({
      orderBy: { nama: 'asc' },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching pegawai:', error);
    return NextResponse.json([]);
  }
}

// POST /api/pegawai - Create new pegawai
export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();
    const body = await request.json();
    const { nama, nip, pangkatGolRuang, jabatan, fotoUrl, noWa } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    const pegawai = await db.pegawai.create({
      data: {
        nama: nama.trim(),
        nip: nip?.trim() || '',
        pangkatGolRuang: pangkatGolRuang?.trim() || '',
        jabatan: jabatan?.trim() || '',
        fotoUrl: fotoUrl || '',
        noWa: noWa?.trim() || '',
      },
    });

    return NextResponse.json(pegawai, { status: 201 });
  } catch (error) {
    console.error('Error creating pegawai:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan data pegawai. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}
