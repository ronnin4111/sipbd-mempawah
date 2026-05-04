import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data } = body as {
      password: string;
      data: Record<string, unknown>;
    };

    // Verify password
    if (password !== IMPORT_PASSWORD) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!data.year || !data.kecamatan || !data.desa ||
        !data.fishType || !data.containerType || !data.businessType) {
      return NextResponse.json(
        { error: 'Field wajib tidak lengkap (tahun, kecamatan, desa, jenis ikan, jenis wadah, jenis usaha)' },
        { status: 400 }
      );
    }

    const record = await db.fishFarm.create({
      data: {
        year: Number(data.year),
        kecamatan: String(data.kecamatan),
        desa: String(data.desa),
        fishType: String(data.fishType),
        containerType: String(data.containerType),
        businessType: String(data.businessType),
        farmerName: String(data.farmerName || ''),
        groupName: String(data.groupName || ''),
        productionQty: Number(data.productionQty) || 0,
        rtpCount: Number(data.rtpCount) || 0,
        farmerCount: Number(data.farmerCount) || 0,
        groupCount: Number(data.groupCount) || 0,
        targetQty: Number(data.targetQty) || 0,
        productionValue: Number(data.productionValue) || 0,
        latitude: Number(data.latitude) || 0,
        longitude: Number(data.longitude) || 0,
        kusuka: String(data.kusuka || '').trim().replace(/[^0-9]/g, ''),
        cpib: typeof data.cpib === 'boolean' ? data.cpib : String(data.cpib || '').toLowerCase() === 'ya',
        cbib: typeof data.cbib === 'boolean' ? data.cbib : String(data.cbib || '').toLowerCase() === 'ya',
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Error creating fish farm record:', error);
    return NextResponse.json(
      { error: 'Gagal menambah data' },
      { status: 500 }
    );
  }
}
