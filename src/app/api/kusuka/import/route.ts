import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';
import * as XLSX from 'xlsx';

// Column header → Prisma model field mapping
const COLUMN_MAP: Record<string, string> = {
  'NAMA': 'nama',
  'PROVINSI': 'provinsi',
  'KAB/KOTA': 'kabKota',
  'KECAMATAN': 'kecamatan',
  'KEL/DESA': 'kelDesa',
  'NO KUSUKA': 'noKusuka',
  'Nama Kelompok': 'namaKelompok',
  'BENTUK USAHA': 'bentukUsaha',
  'PROFESI UTAMA': 'profesiUtama',
  'ALAMAT': 'alamat',
  'TANGGAL DI BUAT': 'tglDibuat',
  'DIBUAT OLEH': 'dibuatOleh',
  'TGL DIPERBAHARUI': 'tglDiperbaharui',
  'DIPERBAHARUI OLEH': 'diperbaharuiOleh',
  'DIVALIDASI OLEH': 'divalidasiOleh',
  'TGL DIVALIDASI': 'tglDivalidasi',
  'STATUS KUSUKA': 'statusKusuka',
};

// Indonesian month mapping for date parsing
const INDONESIAN_MONTHS: Record<string, number> = {
  'januari': 1,
  'februari': 2,
  'maret': 3,
  'april': 4,
  'mei': 5,
  'juni': 6,
  'juli': 7,
  'agustus': 8,
  'september': 9,
  'oktober': 10,
  'november': 11,
  'desember': 12,
};

/**
 * Parse Indonesian date format like "13 April 2026", "30 Mei 2024", "8 Desember 2018"
 * Also handles Excel serial date numbers and ISO date strings.
 */
function parseIndonesianDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  // Handle "-" as null (common placeholder in the data)
  if (typeof value === 'string' && value.trim() === '-') return null;

  // If already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // If it's a number, treat as Excel serial date
  if (typeof value === 'number') {
    if (!isFinite(value)) return null;
    // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try Indonesian format: "13 April 2026" or "8 Desember 2018"
  const indoMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (indoMatch) {
    const day = parseInt(indoMatch[1], 10);
    const monthName = indoMatch[2].toLowerCase();
    const year = parseInt(indoMatch[3], 10);
    const month = INDONESIAN_MONTHS[monthName];
    if (month) {
      return new Date(year, month - 1, day);
    }
  }

  // Try standard ISO / parseable date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Normalize NO KUSUKA: 16-digit numbers get truncated in Excel.
 * Read as text using cell.w (formatted text) or cell.v with formatting.
 */
function normalizeNoKusuka(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) {
      return String(value);
    }
    return String(value).replace(/[^0-9]/g, '');
  }
  let str = String(value).trim();
  // Already a proper 16-digit string
  if (/^\d{16}$/.test(str)) return str;
  // Handle scientific notation
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) return num.toFixed(0);
  }
  // Strip non-digit characters
  return str.replace(/[^0-9]/g, '');
}

/**
 * Map Excel column headers to Prisma model field names.
 * Returns a new object with mapped keys.
 */
function mapRowColumns(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(row)) {
    const trimmedHeader = header.trim();
    const fieldName = COLUMN_MAP[trimmedHeader];
    if (fieldName) {
      mapped[fieldName] = value;
    } else {
      // Keep unmapped columns with original key (for reference)
      mapped[trimmedHeader] = value;
    }
  }
  return mapped;
}

/**
 * Fix NO KUSUKA precision issues by reading raw cell text from the worksheet.
 * Excel truncates 16-digit numbers; we use cell.w (formatted text) to preserve them.
 */
function fixNoKusukaPrecision(
  ws: XLSX.WorkSheet,
  jsonData: Record<string, unknown>[],
  headers: string[],
): void {
  // Find the "NO KUSUKA" column in the original headers
  let noKusukaHeader: string | null = null;
  for (const h of headers) {
    if (h.trim() === 'NO KUSUKA') {
      noKusukaHeader = h;
      break;
    }
  }
  if (!noKusukaHeader) return;

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let kusukaCol = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const headerCell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (headerCell && String(headerCell.v).trim() === 'NO KUSUKA') {
      kusukaCol = c;
      break;
    }
  }
  if (kusukaCol < 0) return;

  // Read raw cell values for each data row
  const rawValues: string[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: kusukaCol })];
    if (cell) {
      // Prefer cell.w (formatted text) which preserves the full digit string
      // Fallback to String(cell.v) if cell.w is not available
      rawValues.push((cell.w || String(cell.v || '')).replace(/[^0-9]/g, ''));
    } else {
      rawValues.push('');
    }
  }

  // Apply fixed values back to mapped jsonData
  if (rawValues.length === jsonData.length) {
    jsonData.forEach((row, i) => {
      row.noKusuka = rawValues[i];
    });
  }
}

/**
 * Build a Prisma-compatible record from a mapped row.
 */
function buildRecord(row: Record<string, unknown>): Record<string, unknown> | null {
  const nama = String(row.nama || '').trim();
  const kecamatan = String(row.kecamatan || '').trim();
  const kelDesa = String(row.kelDesa || '').trim();

  // Required fields validation
  if (!nama) return null;
  if (!kecamatan) return null;
  if (!kelDesa) return null;

  return {
    nama,
    provinsi: String(row.provinsi || '').trim() || 'KALIMANTAN BARAT',
    kabKota: String(row.kabKota || '').trim() || 'MEMPAWAH',
    kecamatan,
    kelDesa,
    noKusuka: normalizeNoKusuka(row.noKusuka as string | number),
    namaKelompok: String(row.namaKelompok || '').trim(),
    bentukUsaha: String(row.bentukUsaha || '').trim() || 'Perseorangan',
    profesiUtama: String(row.profesiUtama || '').trim() || 'Subsektor Pembudidaya Ikan',
    alamat: String(row.alamat || '').trim(),
    tglDibuat: parseIndonesianDate(row.tglDibuat) ?? new Date(),
    dibuatOleh: String(row.dibuatOleh || '').trim(),
    tglDiperbaharui: parseIndonesianDate(row.tglDiperbaharui) ?? new Date(),
    diperbaharuiOleh: String(row.diperbaharuiOleh || '').trim(),
    divalidasiOleh: String(row.divalidasiOleh || '').trim(),
    tglDivalidasi: parseIndonesianDate(row.tglDivalidasi),
    statusKusuka: String(row.statusKusuka || '').trim() || 'Valid',
  };
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // ── JSON mode: direct data array for seed ──
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { password, replaceAll, data } = body as {
        password?: string;
        replaceAll?: boolean;
        data?: Record<string, unknown>[];
      };

      if (password !== IMPORT_PASSWORD) {
        return NextResponse.json({ error: 'Password tidak valid' }, { status: 401 });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return NextResponse.json(
          { error: 'Data tidak ditemukan atau kosong' },
          { status: 400 },
        );
      }

      // Map JSON field names (they should already use model field names,
      // but also support Excel header names)
      const mappedData = data.map((row) => {
        // If the row has Excel-style headers, map them
        const hasExcelHeaders = Object.keys(row).some(
          (k) => COLUMN_MAP[k.trim()],
        );
        return hasExcelHeaders ? mapRowColumns(row) : row;
      });

      let skippedCount = 0;
      const skippedReasons: string[] = [];
      const formattedRecords: Record<string, unknown>[] = [];

      mappedData.forEach((row, index) => {
        const record = buildRecord(row);
        if (!record) {
          skippedCount++;
          const nama = String(row.nama || '').trim();
          const kec = String(row.kecamatan || '').trim();
          const desa = String(row.kelDesa || '').trim();
          const missing: string[] = [];
          if (!nama) missing.push('NAMA');
          if (!kec) missing.push('KECAMATAN');
          if (!desa) missing.push('KEL/DESA');
          if (skippedReasons.length < 20) {
            skippedReasons.push(
              `Baris ${index + 1}: ${missing.join(', ')} kosong`,
            );
          }
          return;
        }
        formattedRecords.push(record);
      });

      if (formattedRecords.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada data valid', skippedCount, skippedReasons },
          { status: 400 },
        );
      }

      // Delete existing data
      let deletedCount = 0;
      if (replaceAll) {
        const result = await db.kusukaRegistration.deleteMany({});
        deletedCount = result.count;
      }

      // Insert in batches
      let count = 0;
      for (let i = 0; i < formattedRecords.length; i += 5) {
        await db.kusukaRegistration.createMany({
          data: formattedRecords.slice(i, i + 5) as any,
        });
        count += Math.min(5, formattedRecords.length - i);
      }

      return NextResponse.json({
        success: true,
        count,
        deletedCount,
        skippedCount,
        skippedReasons: skippedCount > 0 ? skippedReasons : undefined,
      });
    }

    // ── FormData mode: Excel file upload ──
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

    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan file .xlsx atau .xls' },
        { status: 400 },
      );
    }

    // Read Excel file from buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
    });

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });
    }

    // Map column headers to model field names
    const originalHeaders = Object.keys(rawData[0]);
    const jsonData = rawData.map((row) => mapRowColumns(row));

    // Fix NO KUSUKA precision issues by reading raw cells
    fixNoKusukaPrecision(ws, jsonData, originalHeaders);

    // Validate and format records
    let skippedCount = 0;
    const skippedReasons: string[] = [];
    const formattedRecords: Record<string, unknown>[] = [];

    jsonData.forEach((row, index) => {
      const record = buildRecord(row);
      if (!record) {
        skippedCount++;
        const nama = String(row.nama || '').trim();
        const kec = String(row.kecamatan || '').trim();
        const desa = String(row.kelDesa || '').trim();
        const missing: string[] = [];
        if (!nama) missing.push('NAMA');
        if (!kec) missing.push('KECAMATAN');
        if (!desa) missing.push('KEL/DESA');
        if (skippedReasons.length < 20) {
          skippedReasons.push(
            `Baris ${index + 2}: ${missing.join(', ')} kosong`,
          );
        }
        return;
      }
      formattedRecords.push(record);
    });

    if (formattedRecords.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid', skippedCount, skippedReasons },
        { status: 400 },
      );
    }

    // Delete existing data based on mode
    let deletedCount = 0;
    if (replaceAll) {
      const result = await db.kusukaRegistration.deleteMany({});
      deletedCount = result.count;
    }

    // Insert in small batches for stability
    let count = 0;
    for (let i = 0; i < formattedRecords.length; i += 5) {
      await db.kusukaRegistration.createMany({
        data: formattedRecords.slice(i, i + 5) as any,
      });
      count += Math.min(5, formattedRecords.length - i);
    }

    return NextResponse.json({
      success: true,
      count,
      deletedCount,
      skippedCount,
      skippedReasons: skippedCount > 0 ? skippedReasons : undefined,
    });
  } catch (error) {
    console.error('Error importing KUSUKA:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengimpor';
    return NextResponse.json(
      { error: `Gagal mengimpor: ${message}` },
      { status: 500 },
    );
  }
}
