import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';
import { generateFarmerId } from '@/lib/farmer-id';
import * as XLSX from 'xlsx';

const DEFAULT_FISH_TYPE = 'Lainnya';
const DEFAULT_KECAMATAN = 'Tidak Diketahui';
const DEFAULT_DESA = 'Tidak Diketahui';

const CONTAINER_TYPE_ALIASES: Record<string, string> = {
  'kja': 'KJA', 'kjt': 'KJT', 'kolam': 'Kolam',
  'kolam air tenang': 'Kolam Air Tenang', 'kolam terpal': 'Kolam Terpal',
  'bak semen': 'Bak Semen', 'bak terpal': 'Bak Terpal', 'tambak': 'Tambak',
  'bioflok': 'Bioflok', 'bioflock': 'Bioflok', 'jaring tancap': 'KJA',
  'keramba': 'KJA', 'sawah': 'Sawah',
};

function normalizeContainerType(value: string): string {
  const lower = value.toLowerCase().trim();
  return CONTAINER_TYPE_ALIASES[lower] || value.trim();
}

function normalizeKusuka(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) return String(value);
    return String(value).replace(/[^0-9]/g, '');
  }
  let str = String(value).trim();
  if (/^\d{16}$/.test(str)) return str;
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) return num.toFixed(0);
  }
  return str.replace(/[^0-9]/g, '');
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;
    const file = formData.get('file') as File;
    const replaceAll = formData.get('replaceAll') === 'true';

    if (password !== IMPORT_PASSWORD) {
      return NextResponse.json({ error: 'Password tidak valid' }, { status: 401 });
    }
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Read Excel file directly from buffer (no large JSON payload)
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });
    }

    const headers = Object.keys(jsonData[0]);
    const requiredHeaders = [
      'year', 'kecamatan', 'desa', 'fishType', 'containerType', 'businessType',
      'farmerName', 'groupName', 'productionQty', 'rtpCount', 'farmerCount',
      'groupCount', 'targetQty', 'productionValue', 'latitude', 'longitude',
    ];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ error: `Kolom tidak ditemukan: ${missingHeaders.join(', ')}` }, { status: 400 });
    }

    // Fix KUSUKA precision
    if (headers.includes('kusuka')) {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      let kusukaCol = -1;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const headerCell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
        if (headerCell && String(headerCell.v).trim().toLowerCase() === 'kusuka') { kusukaCol = c; break; }
      }
      if (kusukaCol >= 0) {
        const kusukaValues: string[] = [];
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: kusukaCol })];
          kusukaValues.push(cell ? (cell.w || String(cell.v || '')).replace(/[^0-9]/g, '') : '');
        }
        if (kusukaValues.length === jsonData.length) {
          jsonData.forEach((row, i) => { row.kusuka = kusukaValues[i]; });
        }
      }
    }

    // Validate and format
    let fishTypeAutoFilled = 0, kecamatanAutoFilled = 0, desaAutoFilled = 0, skippedCount = 0;
    const skippedReasons: string[] = [];
    const formattedRecords: Array<Record<string, unknown>> = [];

    jsonData.forEach((row, index) => {
      const year = Number(row.year);
      const kecamatan = String(row.kecamatan || '').trim();
      const desa = String(row.desa || '').trim();
      const fishType = String(row.fishType || '').trim();
      const containerType = String(row.containerType || '').trim();
      const businessType = String(row.businessType || '').trim();

      const missing: string[] = [];
      if (!year || year <= 0 || isNaN(year)) missing.push('Tahun');
      if (!containerType) missing.push('Jenis Wadah');
      if (!businessType) missing.push('Jenis Usaha');

      if (missing.length > 0) {
        skippedCount++;
        if (skippedReasons.length < 20) skippedReasons.push(`Baris ${index + 2}: ${missing.join(', ')} kosong`);
        return;
      }

      if (!kecamatan) kecamatanAutoFilled++;
      if (!desa) desaAutoFilled++;
      if (!fishType) fishTypeAutoFilled++;

      const farmerName = String(row.farmerName || '').trim();
      const groupName = String(row.groupName || '').trim();
      const kec = kecamatan || DEFAULT_KECAMATAN;
      const des = desa || DEFAULT_DESA;

      formattedRecords.push({
        year,
        farmerId: generateFarmerId({ farmerName, groupName, kecamatan: kec, desa: des }),
        kecamatan: kec,
        desa: des,
        fishType: fishType || DEFAULT_FISH_TYPE,
        containerType: normalizeContainerType(containerType),
        businessType,
        farmerName,
        groupName,
        productionQty: Number(row.productionQty) || 0,
        rtpCount: Number(row.rtpCount) || 0,
        farmerCount: Number(row.farmerCount) || 0,
        groupCount: Number(row.groupCount) || 0,
        targetQty: Number(row.targetQty) || 0,
        productionValue: Number(row.productionValue) || 0,
        latitude: Number(row.latitude) || 0,
        longitude: Number(row.longitude) || 0,
        kusuka: normalizeKusuka(row.kusuka as string | number),
        cpib: typeof row.cpib === 'boolean' ? row.cpib : String(row.cpib || '').toLowerCase() === 'ya',
        cbib: typeof row.cbib === 'boolean' ? row.cbib : String(row.cbib || '').toLowerCase() === 'ya',
      });
    });

    if (formattedRecords.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data valid', skippedCount, skippedReasons }, { status: 400 });
    }

    // Delete existing data based on mode
    let deletedCount = 0;
    if (replaceAll) {
      // ONLY delete records for the years present in the import data
      // This way importing 2023 data won't wipe out 2022 data
      const importYears = [...new Set(formattedRecords.map(r => Number(r.year)))];
      const r = await db.fishFarm.deleteMany({
        where: { year: { in: importYears } }
      });
      deletedCount = r.count;
    } else {
      // Delete records matching composite keys (year+kecamatan+desa+fishType+containerType+businessType)
      const compositeKeys = new Map<string, Record<string, unknown>>();
      for (const record of formattedRecords) {
        const key = `${record.year}|${record.kecamatan}|${record.desa}|${record.fishType}|${record.containerType}|${record.businessType}`;
        if (!compositeKeys.has(key)) {
          compositeKeys.set(key, record);
        }
      }
      for (const record of compositeKeys.values()) {
        const result = await db.fishFarm.deleteMany({
          where: {
            year: Number(record.year),
            kecamatan: String(record.kecamatan),
            desa: String(record.desa),
            fishType: String(record.fishType),
            containerType: String(record.containerType),
            businessType: String(record.businessType),
          },
        });
        deletedCount += result.count;
      }
    }

    // Insert in tiny batches for stability
    let count = 0;
    for (let i = 0; i < formattedRecords.length; i += 5) {
      await db.fishFarm.createMany({ data: formattedRecords.slice(i, i + 5) as any });
      count += Math.min(5, formattedRecords.length - i);
    }

    const autoFilledInfo: string[] = [];
    if (fishTypeAutoFilled > 0) autoFilledInfo.push(`${fishTypeAutoFilled} baris "Jenis Ikan" diisi otomatis: "${DEFAULT_FISH_TYPE}"`);
    if (kecamatanAutoFilled > 0) autoFilledInfo.push(`${kecamatanAutoFilled} baris "Kecamatan" diisi otomatis: "${DEFAULT_KECAMATAN}"`);
    if (desaAutoFilled > 0) autoFilledInfo.push(`${desaAutoFilled} baris "Desa" diisi otomatis: "${DEFAULT_DESA}"`);

    // Include which years were affected
    const affectedYears = [...new Set(formattedRecords.map(r => Number(r.year)))];

    return NextResponse.json({
      success: true, count, deletedCount, skippedCount,
      skippedReasons: skippedCount > 0 ? skippedReasons : undefined,
      autoFilledInfo: autoFilledInfo.length > 0 ? autoFilledInfo : undefined,
      affectedYears,
    });
  } catch (error) {
    console.error('Error importing:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengimpor';
    return NextResponse.json({ error: `Gagal mengimpor: ${message}` }, { status: 500 });
  }
}
