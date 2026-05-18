import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/pegawai/[id] - Update pegawai
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nama, nip, pangkatGolRuang, jabatan } = body;
    
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama is required' }, { status: 400 });
    }
    
    const pegawai = await db.pegawai.update({
      where: { id },
      data: {
        nama: nama.trim(),
        nip: nip?.trim() || '',
        pangkatGolRuang: pangkatGolRuang?.trim() || '',
        jabatan: jabatan?.trim() || '',
      },
    });
    
    return NextResponse.json(pegawai);
  } catch (error) {
    console.error('Error updating pegawai:', error);
    return NextResponse.json({ error: 'Failed to update pegawai' }, { status: 500 });
  }
}

// DELETE /api/pegawai/[id] - Delete pegawai
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.pegawai.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pegawai:', error);
    return NextResponse.json({ error: 'Failed to delete pegawai' }, { status: 500 });
  }
}
