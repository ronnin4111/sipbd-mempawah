import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

// PUT /api/penyuluh/[id] - Update penyuluh
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;
    const body = await request.json();
    const { nama, nip, pangkatGolRuang, jabatan, fotoUrl, noWa } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    const penyuluh = await db.penyuluh.update({
      where: { id },
      data: {
        nama: nama.trim(),
        nip: nip?.trim() || '',
        pangkatGolRuang: pangkatGolRuang?.trim() || '',
        jabatan: jabatan?.trim() || '',
        fotoUrl: fotoUrl || '',
        noWa: noWa?.trim() || '',
      },
    });

    return NextResponse.json(penyuluh);
  } catch (error) {
    console.error('Error updating penyuluh:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui data penyuluh' },
      { status: 500 }
    );
  }
}

// DELETE /api/penyuluh/[id] - Delete penyuluh
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const { id } = await params;
    await db.penyuluh.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting penyuluh:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus data penyuluh' },
      { status: 500 }
    );
  }
}
