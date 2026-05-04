import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if record exists
    const existing = await db.fishFarm.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};
    if (data.year !== undefined) updateData.year = Number(data.year);
    if (data.kecamatan !== undefined) updateData.kecamatan = String(data.kecamatan);
    if (data.desa !== undefined) updateData.desa = String(data.desa);
    if (data.fishType !== undefined) updateData.fishType = String(data.fishType);
    if (data.containerType !== undefined) updateData.containerType = String(data.containerType);
    if (data.businessType !== undefined) updateData.businessType = String(data.businessType);
    if (data.farmerName !== undefined) updateData.farmerName = String(data.farmerName);
    if (data.groupName !== undefined) updateData.groupName = String(data.groupName);
    if (data.productionQty !== undefined) updateData.productionQty = Number(data.productionQty) || 0;
    if (data.rtpCount !== undefined) updateData.rtpCount = Number(data.rtpCount) || 0;
    if (data.farmerCount !== undefined) updateData.farmerCount = Number(data.farmerCount) || 0;
    if (data.groupCount !== undefined) updateData.groupCount = Number(data.groupCount) || 0;
    if (data.targetQty !== undefined) updateData.targetQty = Number(data.targetQty) || 0;
    if (data.productionValue !== undefined) updateData.productionValue = Number(data.productionValue) || 0;
    if (data.latitude !== undefined) updateData.latitude = Number(data.latitude) || 0;
    if (data.longitude !== undefined) updateData.longitude = Number(data.longitude) || 0;
    if (data.kusuka !== undefined) updateData.kusuka = typeof data.kusuka === 'boolean' ? data.kusuka : String(data.kusuka).toLowerCase() === 'ya';
    if (data.cpib !== undefined) updateData.cpib = typeof data.cpib === 'boolean' ? data.cpib : String(data.cpib).toLowerCase() === 'ya';
    if (data.cbib !== undefined) updateData.cbib = typeof data.cbib === 'boolean' ? data.cbib : String(data.cbib).toLowerCase() === 'ya';

    const record = await db.fishFarm.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Error updating fish farm record:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah data' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { password } = body as { password: string };

    // Verify password
    if (password !== IMPORT_PASSWORD) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Check if record exists
    const existing = await db.fishFarm.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }

    await db.fishFarm.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting fish farm record:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus data' },
      { status: 500 }
    );
  }
}
