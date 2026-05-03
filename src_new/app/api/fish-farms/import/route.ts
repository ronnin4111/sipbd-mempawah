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

export const maxDuration = 60; // 60 seconds timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data, replaceAll } = body as { password: string; data: ImportFishFarm[]; replaceAll?: boolean };

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
    let deletedCount = 0;

    // Filter valid records first
    const validRecords = data.filter((record) =>
      record.year && record.kecamatan && record.desa &&
      record.fishType && record.containerType && record.businessType
    );

    if (validRecords.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid untuk diimpor' },
        { status: 400 }
      );
    }

    // Format records for bulk insert
    const formattedRecords = validRecords.map((record) => ({
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
    }));

    await db.$transaction(async (tx) => {
      // If replaceAll mode, delete ALL existing data first
      if (replaceAll) {
        const deleteResult = await tx.fishFarm.deleteMany({});
        deletedCount = deleteResult.count;
      } else {
        // Delete existing records with same composite keys
        for (const record of validRecords) {
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
        }
      }

      // Bulk insert in batches of 50 to avoid timeout
      const BATCH_SIZE = 50;
      for (let i = 0; i < formattedRecords.length; i += BATCH_SIZE) {
        const batch = formattedRecords.slice(i, i + BATCH_SIZE);
        await tx.fishFarm.createMany({
          data: batch,
          skipDuplicates: true,
        });
        count += batch.length;
      }
    });

    return NextResponse.json({ success: true, count, deletedCount });
  } catch (error) {
    console.error('Error importing fish farms:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengimpor data perikanan';
    return NextResponse.json(
      { error: `Gagal mengimpor: ${message}` },
      { status: 500 }
    );
  }
}
