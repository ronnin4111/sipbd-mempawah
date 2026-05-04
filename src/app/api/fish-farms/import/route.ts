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
  kusuka?: boolean | string;
  cpib?: boolean | string;
  cbib?: boolean | string;
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
    const skippedReasons: string[] = [];

    // Validate each record and collect detailed skip reasons
    const validRecords: ImportFishFarm[] = [];
    const skippedIndexes: number[] = [];

    data.forEach((record, index) => {
      const missing: string[] = [];

      // Check year - must be a valid number > 0
      const year = Number(record.year);
      if (!year || year <= 0 || isNaN(year)) {
        missing.push('Tahun');
      }

      // Check string fields - must be non-empty after trimming
      if (!String(record.kecamatan || '').trim()) {
        missing.push('Kecamatan');
      }
      if (!String(record.desa || '').trim()) {
        missing.push('Desa');
      }
      if (!String(record.fishType || '').trim()) {
        missing.push('Jenis Ikan');
      }
      if (!String(record.containerType || '').trim()) {
        missing.push('Jenis Wadah');
      }
      if (!String(record.businessType || '').trim()) {
        missing.push('Jenis Usaha');
      }

      if (missing.length > 0) {
        skippedIndexes.push(index);
        // Only store unique reason patterns (avoid flooding with 300+ identical reasons)
        const reason = `Baris ${index + 2}: ${missing.join(', ')} kosong`;
        if (skippedReasons.length < 20) {
          skippedReasons.push(reason);
        }
      } else {
        validRecords.push(record);
      }
    });

    if (validRecords.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid untuk diimpor', skippedCount: data.length, skippedReasons },
        { status: 400 }
      );
    }

    // Format records for bulk insert
    const formattedRecords = validRecords.map((record) => ({
      year: Number(record.year),
      kecamatan: String(record.kecamatan).trim(),
      desa: String(record.desa).trim(),
      fishType: String(record.fishType).trim(),
      containerType: String(record.containerType).trim(),
      businessType: String(record.businessType).trim(),
      farmerName: String(record.farmerName || '').trim(),
      groupName: String(record.groupName || '').trim(),
      productionQty: Number(record.productionQty) || 0,
      rtpCount: Number(record.rtpCount) || 0,
      farmerCount: Number(record.farmerCount) || 0,
      groupCount: Number(record.groupCount) || 0,
      targetQty: Number(record.targetQty) || 0,
      productionValue: Number(record.productionValue) || 0,
      latitude: Number(record.latitude) || 0,
      longitude: Number(record.longitude) || 0,
      kusuka: typeof record.kusuka === 'boolean' ? record.kusuka : String(record.kusuka || '').toLowerCase() === 'ya',
      cpib: typeof record.cpib === 'boolean' ? record.cpib : String(record.cpib || '').toLowerCase() === 'ya',
      cbib: typeof record.cbib === 'boolean' ? record.cbib : String(record.cbib || '').toLowerCase() === 'ya',
    }));

    await db.$transaction(async (tx) => {
      // If replaceAll mode, delete ALL existing data first
      if (replaceAll) {
        const deleteResult = await tx.fishFarm.deleteMany({});
        deletedCount = deleteResult.count;
      } else {
        // Delete existing records with same composite keys - batch by unique composite keys
        const compositeKeys = new Map<string, ImportFishFarm>();
        for (const record of validRecords) {
          const key = `${record.year}|${record.kecamatan}|${record.desa}|${record.fishType}|${record.containerType}|${record.businessType}`;
          if (!compositeKeys.has(key)) {
            compositeKeys.set(key, record);
          }
        }
        for (const record of compositeKeys.values()) {
          await tx.fishFarm.deleteMany({
            where: {
              year: Number(record.year),
              kecamatan: String(record.kecamatan).trim(),
              desa: String(record.desa).trim(),
              fishType: String(record.fishType).trim(),
              containerType: String(record.containerType).trim(),
              businessType: String(record.businessType).trim(),
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
        });
        count += batch.length;
      }
    });

    const skippedCount = data.length - validRecords.length;
    return NextResponse.json({
      success: true,
      count,
      deletedCount,
      skippedCount,
      skippedReasons: skippedCount > 0 ? skippedReasons : undefined,
    });
  } catch (error) {
    console.error('Error importing fish farms:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengimpor data perikanan';
    return NextResponse.json(
      { error: `Gagal mengimpor: ${message}` },
      { status: 500 }
    );
  }
}
