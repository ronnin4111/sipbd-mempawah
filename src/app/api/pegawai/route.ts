import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/pegawai - List all pegawai
export async function GET() {
  try {
    const data = await db.pegawai.findMany({
      orderBy: { nama: 'asc' },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching pegawai:', error);
    return NextResponse.json({ error: 'Failed to fetch pegawai' }, { status: 500 });
  }
}

// POST /api/pegawai - Create new pegawai
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama, nip, pangkatGolRuang, jabatan } = body;
    
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama is required' }, { status: 400 });
    }
    
    const pegawai = await db.pegawai.create({
      data: {
        nama: nama.trim(),
        nip: nip?.trim() || '',
        pangkatGolRuang: pangkatGolRuang?.trim() || '',
        jabatan: jabatan?.trim() || '',
      },
    });
    
    return NextResponse.json(pegawai, { status: 201 });
  } catch (error) {
    console.error('Error creating pegawai:', error);
    return NextResponse.json({ error: 'Failed to create pegawai' }, { status: 500 });
  }
}
