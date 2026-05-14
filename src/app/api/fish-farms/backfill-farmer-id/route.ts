import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';
import { generateFarmerId } from '@/lib/farmer-id';

/**
 * Backfill farmerId for existing records that don't have one yet.
 * This is a one-time migration endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    // Verify password
    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Find all records with empty farmerId
    const records = await db.fishFarm.findMany({
      where: { farmerId: '' },
    });

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Semua record sudah memiliki farmerId',
        updatedCount: 0,
      });
    }

    let updatedCount = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((record) =>
          db.fishFarm.update({
            where: { id: record.id },
            data: {
              farmerId: generateFarmerId({
                farmerName: record.farmerName || '',
                groupName: record.groupName || '',
                kecamatan: record.kecamatan || '',
                desa: record.desa || '',
              }),
            },
          })
        )
      );
      updatedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan farmerId ke ${updatedCount} record`,
      updatedCount,
    });
  } catch (error) {
    console.error('Error backfilling farmerId:', error);
    const message = error instanceof Error ? error.message : 'Gagal backfill farmerId';
    return NextResponse.json(
      { error: `Gagal backfill: ${message}` },
      { status: 500 }
    );
  }
}
