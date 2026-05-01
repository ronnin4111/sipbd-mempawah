import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';

interface ImportFishFarm {
  year: number;
  kecamatan: string;
  desa: string;
  fishType: string;
  containerType: string;
  businessType: string;
  farmerName?: string;
  groupName?: string;
  productionQty: number;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  targetQty: number;
  productionValue: number;
  latitude: number;
  longitude: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data } = body as { password: string; data: ImportFishFarm[] };

    // Verify password
    if (password !== IMPORT_PASSWORD) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Validate data
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Data tidak valid atau kosong' },
        { status: 400 }
      );
    }

    let count = 0;

    // Process each record using transaction for data integrity
    await db.$transaction(async (tx) => {
      // Group records by unique key (year+kecamatan+desa+fishType+containerType+businessType)
      // Delete existing matching records first, then insert new ones
      for (const record of data) {
        // Validate required fields
        if (
          !record.year || !record.kecamatan || !record.desa ||
          !record.fishType || !record.containerType || !record.businessType
        ) {
          continue; // Skip invalid records
        }

        // Delete existing record with same composite key
        await tx.fishFarm.deleteMany({
          where: {
            year: Number(record.year),
            kecamatan: record.kecamatan,
            desa: record.desa,
            fishType: record.fishType,
            containerType: record.containerType,
            businessType: record.businessType,
          },
        });

        // Insert new record
        await tx.fishFarm.create({
          data: {
            year: Number(record.year),
            kecamatan: String(record.kecamatan),
            desa: String(record.desa),
            fishType: String(record.fishType),
            containerType: String(record.containerType),
            businessType: String(record.businessType),
            farmerName: String(record.farmerName || ''),
            groupName: String(record.groupName || ''),
            productionQty: Number(record.productionQty) || 0,
            rtpCount: Number(record.rtpCount) || 0,
            farmerCount: Number(record.farmerCount) || 0,
            groupCount: Number(record.groupCount) || 0,
            targetQty: Number(record.targetQty) || 0,
            productionValue: Number(record.productionValue) || 0,
            latitude: Number(record.latitude) || 0,
            longitude: Number(record.longitude) || 0,
          },
        });

        count++;
      }
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Error importing fish farms:', error);
    return NextResponse.json(
      { error: 'Gagal mengimpor data perikanan' },
      { status: 500 }
    );
  }
}
