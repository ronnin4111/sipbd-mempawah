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
  kusuka?: string | number;
  cpib?: boolean | string;
  cbib?: boolean | string;
}

// Default values for empty required fields
const DEFAULT_FISH_TYPE = 'Lainnya';
const DEFAULT_KECAMATAN = 'Tidak Diketahui';
const DEFAULT_DESA = 'Tidak Diketahui';

// Normalize container type names from Excel to match system constants
const CONTAINER_TYPE_ALIASES: Record<string, string> = {
  'kja': 'KJA',
  'kjt': 'KJT',
  'kolam': 'Kolam',
  'kolam air tenang': 'Kolam Air Tenang',
  'kolam terpal': 'Kolam Terpal',
  'bak semen': 'Bak Semen',
  'bak terpal': 'Bak Terpal',
  'tambak': 'Tambak',
  'bioflok': 'Bioflok',
  'bioflock': 'Bioflok',
  'jaring tancap': 'KJA',
  'keramba': 'KJA',
  'sawah': 'Sawah',
};

function normalizeContainerType(value: string): string {
  const lower = value.toLowerCase().trim();
  return CONTAINER_TYPE_ALIASES[lower] || value.trim();
}

/**
 * Normalize KUSUKA value from Excel.
 * Excel may store 16-digit numbers as:
 * - Number type (e.g. 1234567890123456) → JS reads as number, may lose precision
 * - Text type with apostrophe ('1234567890123456) → JS reads as string "1234567890123456"
 * - Scientific notation from number conversion (e.g. 1.2345678901234E+15)
 * This function converts all formats to a clean digit string.
 */
function normalizeKusuka(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) {
      return String(value);
    }
    return String(value).replace(/[^0-9]/g, '');
  }
  
  let str = String(value).trim();
  if (/^\d{16}$/.test(str)) return str;
  
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      return num.toFixed(0);
    }
  }
  
  return str.replace(/[^0-9]/g, '');
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
    const autoFilledInfo: string[] = [];

    // Validate and auto-fill each record
    const validRecords: ImportFishFarm[] = [];
    let fishTypeAutoFilled = 0;
    let kecamatanAutoFilled = 0;
    let desaAutoFilled = 0;

    data.forEach((record, index) => {
      const missing: string[] = [];

      const year = Number(record.year);
      if (!year || year <= 0 || isNaN(year)) {
        missing.push('Tahun');
      }

      const kecamatan = String(record.kecamatan || '').trim();
      const desa = String(record.desa || '').trim();
      const fishType = String(record.fishType || '').trim();
      const containerType = String(record.containerType || '').trim();
      const businessType = String(record.businessType || '').trim();

      if (!kecamatan) {
        record.kecamatan = DEFAULT_KECAMATAN;
        kecamatanAutoFilled++;
      }
      if (!desa) {
        record.desa = DEFAULT_DESA;
        desaAutoFilled++;
      }
      if (!fishType) {
        record.fishType = DEFAULT_FISH_TYPE;
        fishTypeAutoFilled++;
      }

      if (!containerType) {
        missing.push('Jenis Wadah');
      }
      if (!businessType) {
        missing.push('Jenis Usaha');
      }

      if (missing.length > 0) {
        const reason = `Baris ${index + 2}: ${missing.join(', ')} kosong`;
        if (skippedReasons.length < 20) {
          skippedReasons.push(reason);
        }
      } else {
        validRecords.push(record);
      }
    });

    if (fishTypeAutoFilled > 0) {
      autoFilledInfo.push(`${fishTypeAutoFilled} baris "Jenis Ikan" diisi otomatis: "${DEFAULT_FISH_TYPE}"`);
    }
    if (kecamatanAutoFilled > 0) {
      autoFilledInfo.push(`${kecamatanAutoFilled} baris "Kecamatan" diisi otomatis: "${DEFAULT_KECAMATAN}"`);
    }
    if (desaAutoFilled > 0) {
      autoFilledInfo.push(`${desaAutoFilled} baris "Desa" diisi otomatis: "${DEFAULT_DESA}"`);
    }

    if (validRecords.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid untuk diimpor', skippedCount: data.length, skippedReasons },
        { status: 400 }
      );
    }

    // Format records for bulk insert
    const formattedRecords = validRecords.map((record) => ({
      year: Number(record.year),
      kecamatan: String(record.kecamatan || '').trim() || DEFAULT_KECAMATAN,
      desa: String(record.desa || '').trim() || DEFAULT_DESA,
      fishType: String(record.fishType || '').trim() || DEFAULT_FISH_TYPE,
      containerType: normalizeContainerType(String(record.containerType || '')),
      businessType: String(record.businessType || '').trim(),
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
      kusuka: normalizeKusuka(record.kusuka),
      cpib: typeof record.cpib === 'boolean' ? record.cpib : String(record.cpib || '').toLowerCase() === 'ya',
      cbib: typeof record.cbib === 'boolean' ? record.cbib : String(record.cbib || '').toLowerCase() === 'ya',
    }));

    // Step 1: Delete existing data based on mode
    if (replaceAll) {
      // ONLY delete records for the years present in the import data
      // This way importing 2023 data won't wipe out 2022 data
      const importYears = [...new Set(formattedRecords.map(r => r.year))];
      const deleteResult = await db.fishFarm.deleteMany({
        where: { year: { in: importYears } }
      });
      deletedCount = deleteResult.count;
    } else {
      // Delete existing records with same composite keys
      const compositeKeys = new Map<string, ImportFishFarm>();
      for (const record of validRecords) {
        const key = `${record.year}|${record.kecamatan}|${record.desa}|${record.fishType}|${record.containerType}|${record.businessType}`;
        if (!compositeKeys.has(key)) {
          compositeKeys.set(key, record);
        }
      }
      for (const record of compositeKeys.values()) {
        await db.fishFarm.deleteMany({
          where: {
            year: Number(record.year),
            kecamatan: String(record.kecamatan || '').trim() || DEFAULT_KECAMATAN,
            desa: String(record.desa || '').trim() || DEFAULT_DESA,
            fishType: String(record.fishType || '').trim() || DEFAULT_FISH_TYPE,
            containerType: normalizeContainerType(String(record.containerType || '')),
            businessType: String(record.businessType).trim(),
          },
        });
      }
    }

    // Step 2: Insert in small batches (outside transaction for stability)
    const BATCH_SIZE = 10;
    for (let i = 0; i < formattedRecords.length; i += BATCH_SIZE) {
      const batch = formattedRecords.slice(i, i + BATCH_SIZE);
      await db.fishFarm.createMany({
        data: batch,
      });
      count += batch.length;
    }

    // Include which years were affected
    const affectedYears = [...new Set(formattedRecords.map(r => r.year))];

    const skippedCount = data.length - validRecords.length;
    return NextResponse.json({
      success: true,
      count,
      deletedCount,
      skippedCount,
      skippedReasons: skippedCount > 0 ? skippedReasons : undefined,
      autoFilledInfo: autoFilledInfo.length > 0 ? autoFilledInfo : undefined,
      affectedYears,
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
