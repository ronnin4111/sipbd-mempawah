import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/penyuluh - List all penyuluh
export async function GET() {
  try {
    const data = await db.penyuluh.findMany({
      orderBy: { nama: 'asc' },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching penyuluh:', error);
    return NextResponse.json({ error: 'Failed to fetch penyuluh' }, { status: 500 });
  }
}

// POST /api/penyuluh - Create new penyuluh
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama, nip, pangkatGolRuang, jabatan } = body;
    
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama is required' }, { status: 400 });
    }
    
    const penyuluh = await db.penyuluh.create({
      data: {
        nama: nama.trim(),
        nip: nip?.trim() || '',
        pangkatGolRuang: pangkatGolRuang?.trim() || '',
        jabatan: jabatan?.trim() || '',
      },
    });
    
    return NextResponse.json(penyuluh, { status: 201 });
  } catch (error) {
    console.error('Error creating penyuluh:', error);
    return NextResponse.json({ error: 'Failed to create penyuluh' }, { status: 500 });
  }
}
