import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';
import { verifyPassword } from '@/lib/passwords';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Month name to number mapping (Indonesian)
const BULAN_MAP: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

/**
 * Safely parse a numeric value from an Excel cell.
 * Returns 0 for empty, null, undefined, or non-numeric values.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Safely parse an integer value from an Excel cell.
 */
function toInt(value: unknown): number {
  return Math.round(toNumber(value));
}

/**
 * Safely parse a string value from an Excel cell.
 */
function toStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Determine semester from bulan number.
 * Months 1-6 = Semester 1, Months 7-12 = Semester 2.
 */
function getSemester(bulanNum: number): number {
  return bulanNum <= 6 ? 1 : 2;
}

/**
 * Determine triwulan (quarter) from bulan number.
 * 1-3 = TW1, 4-6 = TW2, 7-9 = TW3, 10-12 = TW4.
 */
function getTriwulan(bulanNum: number): number {
  return Math.ceil(bulanNum / 3);
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();

    // Parse FormData from request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const password = formData.get('password') as string | null;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'File Excel belum dipilih' },
        { status: 400 }
      );
    }

    // Validate password
    if (!password) {
      return NextResponse.json(
        { error: 'Password wajib diisi' },
        { status: 400 }
      );
    }

    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Format file harus .xlsx atau .xls' },
        { status: 400 }
      );
    }

    // Read file as ArrayBuffer and parse with XLSX
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // =============================================
    // 1. Extract year from "Rekap Produksi" sheet
    // =============================================
    const rekapSheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes('rekap produksi')
    );

    if (!rekapSheetName) {
      return NextResponse.json(
        { error: 'Sheet "Rekap Produksi" tidak ditemukan dalam file Excel' },
        { status: 400 }
      );
    }

    const rekapWs = workbook.Sheets[rekapSheetName];
    const rekapData: unknown[][] = XLSX.utils.sheet_to_json(rekapWs, { header: 1 });

    // Row 0, column 2 should contain "PEMBESARAN IKAN - {YEAR}"
    let year = 0;
    const headerCell = toStr(rekapData[0]?.[2]);
    const yearMatch = headerCell.match(/(\d{4})/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Fallback: try other positions or sheet names
    if (!year) {
      // Try row 0 column 0 or other common positions
      for (let row = 0; row < Math.min(rekapData.length, 5); row++) {
        for (let col = 0; col < Math.min((rekapData[row] as unknown[])?.length || 0, 10); col++) {
          const cell = toStr((rekapData[row] as unknown[])?.[col]);
          const m = cell.match(/PEMBESARAN.*?(\d{4})/i);
          if (m) {
            year = parseInt(m[1], 10);
            break;
          }
        }
        if (year) break;
      }
    }

    // Final fallback: use current year
    if (!year) {
      year = new Date().getFullYear();
      console.warn(`[analyze/upload] Could not extract year from Rekap Produksi, using current year: ${year}`);
    }

    // =============================================
    // 2. Parse "Database" sheet for production rows
    // =============================================
    const dbSheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase() === 'database'
    );

    if (!dbSheetName) {
      return NextResponse.json(
        { error: 'Sheet "Database" tidak ditemukan dalam file Excel' },
        { status: 400 }
      );
    }

    const dbWs = workbook.Sheets[dbSheetName];
    const dbRaw: unknown[][] = XLSX.utils.sheet_to_json(dbWs, { header: 1 });

    // Skip first 4 rows (0-3 are headers), data starts at row 4
    const dbRows: unknown[][] = dbRaw.slice(4);

    const analyzeRows: {
      bulan: string;
      bulanNum: number;
      tw: number;
      semester: number;
      jenisWadah: string;
      komoditas: string;
      produksiTon: number;
      produksiKg: number;
      produktifitas: number;
      luasLahan: number;
      hargaRpKg: number;
      nilaiRp: number;
      fcr: number;
      pakanKg: number;
      size: number;
      sr: number;
      agregatBenih: number;
    }[] = [];

    for (const row of dbRows) {
      // Skip empty rows
      if (!row || row.length === 0) continue;

      const komoditas = toStr(row[8]);
      // Skip TOTAL rows and rows where komoditas is empty
      if (!komoditas || komoditas.toUpperCase() === 'TOTAL') continue;

      const bulanStr = toStr(row[4]);
      const bulanNum = BULAN_MAP[bulanStr.toLowerCase()] || toInt(row[4]) || 1;

      analyzeRows.push({
        bulan: bulanStr,
        bulanNum,
        tw: toInt(row[5]) || getTriwulan(bulanNum),
        semester: toInt(row[6]) || getSemester(bulanNum),
        jenisWadah: toStr(row[7]),
        komoditas,
        produksiTon: toNumber(row[9]),
        produksiKg: toNumber(row[10]),
        produktifitas: toNumber(row[11]),
        luasLahan: toNumber(row[12]),
        hargaRpKg: toNumber(row[13]),
        nilaiRp: toNumber(row[14]),
        fcr: toNumber(row[15]),
        pakanKg: toNumber(row[16]),
        size: toNumber(row[17]),
        sr: toNumber(row[18]),
        agregatBenih: toNumber(row[19]),
      });
    }

    // =============================================
    // 3. Parse "Data Populasi" sheet
    // =============================================
    const popSheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes('data populasi')
    );

    const populasiRows: {
      jenisWadah: string;
      jumlahRtp: number;
      jumlahPembudidaya: number;
      luasLahan: number;
    }[] = [];

    if (popSheetName) {
      const popWs = workbook.Sheets[popSheetName];
      const popRaw: unknown[][] = XLSX.utils.sheet_to_json(popWs, { header: 1 });

      // Data starts at row 5 (skip rows 0-4)
      const popData: unknown[][] = popRaw.slice(5);

      for (const row of popData) {
        if (!row || row.length === 0) continue;

        const jenisWadah = toStr(row[2]);
        // Skip TOTAL row and empty rows
        if (!jenisWadah || jenisWadah.toUpperCase() === 'TOTAL') continue;

        populasiRows.push({
          jenisWadah,
          jumlahRtp: toInt(row[3]),
          jumlahPembudidaya: toInt(row[4]),
          luasLahan: toNumber(row[5]),
        });
      }
    } else {
      console.warn('[analyze/upload] Sheet "Data Populasi" tidak ditemukan, melewati data populasi');
    }

    // =============================================
    // 4. Delete existing upload with same year (replace mode)
    // =============================================
    const existingUploads = await db.analyzeUpload.findMany({
      where: { year },
      select: { id: true },
    });

    for (const existing of existingUploads) {
      // Cascade delete will remove related AnalyzeRow and AnalyzePopulasi
      await db.analyzeUpload.delete({
        where: { id: existing.id },
      });
    }

    const deletedCount = existingUploads.length;

    // =============================================
    // 5. Create new AnalyzeUpload with rows
    // =============================================
    const upload = await db.analyzeUpload.create({
      data: {
        year,
        semester: 0, // 0 = full year
        fileName: file.name,
        fileSize: file.size,
        businessType: 'Pembesaran',
        uploadedBy: 'admin',
      },
    });

    // Insert AnalyzeRow records in batches
    const ROW_BATCH_SIZE = 50;
    let rowCount = 0;

    for (let i = 0; i < analyzeRows.length; i += ROW_BATCH_SIZE) {
      const batch = analyzeRows.slice(i, i + ROW_BATCH_SIZE);
      await db.analyzeRow.createMany({
        data: batch.map((row) => ({
          uploadId: upload.id,
          bulan: row.bulan,
          bulanNum: row.bulanNum,
          tw: row.tw,
          semester: row.semester,
          jenisWadah: row.jenisWadah,
          komoditas: row.komoditas,
          produksiTon: row.produksiTon,
          produksiKg: row.produksiKg,
          produktifitas: row.produktifitas,
          luasLahan: row.luasLahan,
          hargaRpKg: row.hargaRpKg,
          nilaiRp: row.nilaiRp,
          fcr: row.fcr,
          pakanKg: row.pakanKg,
          size: row.size,
          sr: row.sr,
          agregatBenih: row.agregatBenih,
        })),
      });
      rowCount += batch.length;
    }

    // Insert AnalyzePopulasi records in batches
    let populasiCount = 0;

    if (populasiRows.length > 0) {
      const POP_BATCH_SIZE = 50;
      for (let i = 0; i < populasiRows.length; i += POP_BATCH_SIZE) {
        const batch = populasiRows.slice(i, i + POP_BATCH_SIZE);
        await db.analyzePopulasi.createMany({
          data: batch.map((row) => ({
            uploadId: upload.id,
            jenisWadah: row.jenisWadah,
            jumlahRtp: row.jumlahRtp,
            jumlahPembudidaya: row.jumlahPembudidaya,
            luasLahan: row.luasLahan,
          })),
        });
        populasiCount += batch.length;
      }
    }

    console.log(
      `[analyze/upload] ✅ Uploaded ${fileName} (year=${year}): ${rowCount} rows, ${populasiCount} populasi, replaced ${deletedCount} old upload(s)`
    );

    return NextResponse.json({
      success: true,
      year,
      uploadId: upload.id,
      rowCount,
      populasiCount,
      deletedCount,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('[analyze/upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengunggah file Excel';
    return NextResponse.json(
      { error: `Gagal mengunggah: ${message}` },
      { status: 500 }
    );
  }
}
