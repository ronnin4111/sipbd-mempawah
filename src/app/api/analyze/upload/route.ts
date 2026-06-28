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

// ============================================================
// Header-based column detection (robust to column shifts)
// ============================================================

/** Normalize a header cell for matching: lowercase, collapse spaces, trim. */
function normalizeHeader(value: unknown): string {
  return toStr(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Map a normalized header to an AnalyzeRow field name.
 * Order matters: more specific/compound fields are checked first.
 */
function detectRowField(norm: string): string | null {
  if (norm === 'bulan') return 'bulan';
  if (norm === 'tw' || norm === 'triwulan') return 'tw';
  if (norm === 'semester' || norm === 'sem') return 'semester';
  if (norm === 'jenis wadah') return 'jenisWadah';
  if (norm === 'komoditas') return 'komoditas';
  // Compound/specific fields before generic ones
  if (norm.includes('produktifitas')) return 'produktifitas';
  if (norm.includes('luas lahan')) return 'luasLahan';
  if (norm.includes('agregat benih') || norm.includes('benih')) return 'agregatBenih';
  if (norm.includes('produksi') && norm.includes('ton')) return 'produksiTon';
  if (norm.includes('produksi') && norm.includes('kg')) return 'produksiKg';
  if (norm.includes('pakan')) return 'pakanKg';
  if (norm.includes('harga')) return 'hargaRpKg';
  if (norm.includes('nilai')) return 'nilaiRp';
  if (norm.includes('size')) return 'size';
  if (norm === 'fcr') return 'fcr';
  if (norm === 'sr') return 'sr';
  return null;
}

/** Map a normalized header to an AnalyzePopulasi field name. */
function detectPopulasiField(norm: string): string | null {
  if (norm.includes('jenis wadah')) return 'jenisWadah';
  if (norm.includes('rtp')) return 'jumlahRtp';
  if (norm.includes('pembudidaya')) return 'jumlahPembudidaya';
  if (norm.includes('luas lahan') || norm.includes('luas')) return 'luasLahan';
  return null;
}

/**
 * Find the header row index by scanning rows for one that contains
 * all the required keywords (matched against normalized cell text).
 */
function findHeaderRow(
  data: unknown[][],
  requiredKeywords: string[],
  maxScan = 15
): number {
  for (let i = 0; i < Math.min(data.length, maxScan); i++) {
    const row = data[i] || [];
    const norms = row.map((c) => normalizeHeader(c));
    const allFound = requiredKeywords.every((kw) =>
      norms.some((n) => n.includes(kw))
    );
    if (allFound) return i;
  }
  return -1;
}

/** Build a column index map { fieldName: columnIndex } from a header row. */
function buildColumnMap(
  headerRow: unknown[],
  detector: (norm: string) => string | null
): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const field = detector(normalizeHeader(cell));
    if (field && map[field] === undefined) {
      map[field] = idx;
    }
  });
  return map;
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
    // 2. Parse "Database" sheet for production rows (header-based)
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

    // Detect header row by looking for "bulan" + "komoditas" + "jenis wadah"
    const dbHeaderIdx = findHeaderRow(dbRaw, ['bulan', 'komoditas', 'jenis wadah'], 15);

    let colMap: Record<string, number>;
    let dbDataStart: number;

    if (dbHeaderIdx >= 0) {
      // Header-based mapping (robust to column shifts / extra columns)
      colMap = buildColumnMap(dbRaw[dbHeaderIdx], detectRowField);
      dbDataStart = dbHeaderIdx + 1;
      console.log(
        `[analyze/upload] Header-based parsing: header row=${dbHeaderIdx}, colMap=`,
        colMap
      );
    } else {
      // Fallback: legacy fixed-index format (data starts at row 4)
      colMap = {
        bulan: 4, tw: 5, semester: 6, jenisWadah: 7, komoditas: 8,
        produksiTon: 9, produksiKg: 10, produktifitas: 11, luasLahan: 12,
        hargaRpKg: 13, nilaiRp: 14, fcr: 15, pakanKg: 16, size: 17, sr: 18, agregatBenih: 19,
      };
      dbDataStart = 4;
      console.warn(
        '[analyze/upload] Header row not detected, using legacy fixed-index parsing'
      );
    }

    const dbRows: unknown[][] = dbRaw.slice(dbDataStart);

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

      const komoditas = toStr(row[colMap.komoditas ?? 8]);
      // Skip TOTAL rows and rows where komoditas is empty
      if (!komoditas || komoditas.toUpperCase() === 'TOTAL') continue;

      const bulanStr = toStr(row[colMap.bulan ?? 4]);
      const bulanNum =
        BULAN_MAP[bulanStr.toLowerCase()] || toInt(row[colMap.bulan ?? 4]) || 1;

      analyzeRows.push({
        bulan: bulanStr,
        bulanNum,
        tw: toInt(row[colMap.tw ?? 5]) || getTriwulan(bulanNum),
        semester: toInt(row[colMap.semester ?? 6]) || getSemester(bulanNum),
        jenisWadah: toStr(row[colMap.jenisWadah ?? 7]),
        komoditas,
        produksiTon: toNumber(row[colMap.produksiTon ?? 9]),
        produksiKg: toNumber(row[colMap.produksiKg ?? 10]),
        produktifitas: toNumber(row[colMap.produktifitas ?? 11]),
        luasLahan: toNumber(row[colMap.luasLahan ?? 12]),
        hargaRpKg: toNumber(row[colMap.hargaRpKg ?? 13]),
        nilaiRp: toNumber(row[colMap.nilaiRp ?? 14]),
        fcr: toNumber(row[colMap.fcr ?? 15]),
        pakanKg: toNumber(row[colMap.pakanKg ?? 16]),
        size: toNumber(row[colMap.size ?? 17]),
        sr: toNumber(row[colMap.sr ?? 18]),
        agregatBenih: toNumber(row[colMap.agregatBenih ?? 19]),
      });
    }

    // =============================================
    // 3. Parse "Data Populasi" sheet (header-based, strict validation)
    // =============================================
    const populasiRows: {
      jenisWadah: string;
      jumlahRtp: number;
      jumlahPembudidaya: number;
      luasLahan: number;
    }[] = [];

    /**
     * Check if a string looks like a valid wadah name (not a code/number).
     * Valid: "Jaring Apung Tawar", "Kolam Air Tenang", "Tambak Intensif"
     * Invalid: "61" (Kode Provinsi), "6102" (Kode Kab/Kota)
     * NOTE: empty string ("") is handled separately — see parsePopulasiSheet.
     */
    function isValidWadahName(s: string): boolean {
      if (!s || s.toUpperCase() === 'TOTAL') return false;
      // Must contain at least one letter and be at least 3 chars
      if (s.length < 3) return false;
      if (!/[a-zA-Z]/.test(s)) return false; // reject pure numbers like "61", "6102"
      // Reject if it's purely numeric with symbols (codes like "61.02")
      if (/^[\d.\-/\s]+$/.test(s)) return false;
      return true;
    }

    /**
     * Parse a populasi sheet (STRICT header-based) and append rows to populasiRows.
     * Returns the number of rows parsed.
     *
     * STRICT mode: requires header row with "jenis wadah" + ("rtp" OR "pembudidaya").
     * Does NOT fall back to legacy fixed-index (which misreads Kode Provinsi/Kab as wadah/pembudidaya).
     * Also validates each parsed row: jenisWadah must be a real name (not a numeric code).
     */
    function parsePopulasiSheet(sheetName: string): number {
      const popWs = workbook.Sheets[sheetName];
      if (!popWs) return 0;
      const popRaw: unknown[][] = XLSX.utils.sheet_to_json(popWs, { header: 1 });

      // STRICT: require "jenis wadah" + ("rtp" OR "pembudidaya") in header
      // This prevents matching monthly sheets (which have "Jenis Wadah" but no RTP/Pembudidaya)
      const popHeaderIdx = findHeaderRow(popRaw, ['jenis wadah'], 10);
      if (popHeaderIdx < 0) {
        console.log(`[analyze/upload] Populasi: sheet "${sheetName}" has no "jenis wadah" header, skipping`);
        return 0;
      }

      // Verify the header also has "rtp" or "pembudidaya" (to confirm it's a populasi sheet)
      const headerNorms = (popRaw[popHeaderIdx] || []).map((c) => normalizeHeader(c));
      const hasRtp = headerNorms.some((n) => n.includes('rtp'));
      const hasPembudidaya = headerNorms.some((n) => n.includes('pembudidaya'));
      if (!hasRtp && !hasPembudidaya) {
        console.log(
          `[analyze/upload] Populasi: sheet "${sheetName}" has "jenis wadah" but no rtp/pembudidaya columns, skipping (likely a production sheet, not populasi)`
        );
        return 0;
      }

      const popColMap = buildColumnMap(popRaw[popHeaderIdx], detectPopulasiField);
      const popDataStart = popHeaderIdx + 1;
      console.log(
        `[analyze/upload] Populasi header-based: sheet="${sheetName}", header row=${popHeaderIdx}, colMap=`,
        popColMap
      );

      // Require at least jenisWadah column to be mapped
      if (popColMap.jenisWadah === undefined) {
        console.warn(`[analyze/upload] Populasi: sheet "${sheetName}" — jenisWadah column not found in header, skipping`);
        return 0;
      }

      const popData: unknown[][] = popRaw.slice(popDataStart);
      let parsed = 0;
      const seenWadah = new Set<string>();
      // Counter for rows where Jenis Wadah is empty — used to generate a fallback name.
      let emptyWadahCounter = 0;

      for (const row of popData) {
        if (!row || row.length === 0) continue;

        const rawWadah = toStr(row[popColMap.jenisWadah]);

        // Read numeric values first — we need them to decide whether to keep the row.
        const rtp = popColMap.jumlahRtp !== undefined ? toInt(row[popColMap.jumlahRtp]) : 0;
        const pembudidaya = popColMap.jumlahPembudidaya !== undefined ? toInt(row[popColMap.jumlahPembudidaya]) : 0;
        const luasLahan = popColMap.luasLahan !== undefined ? toNumber(row[popColMap.luasLahan]) : 0;

        // Skip TOTAL rows explicitly (even though they have numbers, they are aggregates)
        if (rawWadah.toUpperCase() === 'TOTAL') continue;

        // Decide on the final jenisWadah value + dedup key
        let jenisWadah: string;
        let dedupKey: string;

        if (isValidWadahName(rawWadah)) {
          // Real wadah name like "Jaring Apung Tawar"
          jenisWadah = rawWadah;
          dedupKey = rawWadah.toLowerCase();
        } else if (rawWadah === '' || !/[a-zA-Z]/.test(rawWadah)) {
          // Empty wadah OR numeric code (e.g., "61", "6102")
          // Only accept if the row has at least one real numeric value
          if (rtp === 0 && pembudidaya === 0 && luasLahan === 0) {
            // No wadah name AND no numeric data → skip (truly empty row)
            continue;
          }
          // Generate a fallback name based on a counter so each empty-wadah row
          // gets a unique identity (and unique dedup key).
          emptyWadahCounter++;
          jenisWadah = `Wadah ${emptyWadahCounter}`;
          dedupKey = `__empty_${emptyWadahCounter}`;
        } else {
          // Some other non-wadah string → skip
          continue;
        }

        // Deduplicate by wadah name (or fallback key)
        if (seenWadah.has(dedupKey)) continue;

        populasiRows.push({ jenisWadah, jumlahRtp: rtp, jumlahPembudidaya: pembudidaya, luasLahan });
        seenWadah.add(dedupKey);
        parsed++;
      }
      return parsed;
    }

    // Strategy 1: Try the primary "Data Populasi" sheet
    const popSheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes('data populasi')
    );

    if (popSheetName) {
      parsePopulasiSheet(popSheetName);
    } else {
      console.warn('[analyze/upload] Sheet "Data Populasi" tidak ditemukan');
    }

    // Strategy 2: Fallback — if primary sheet yielded 0 rows, scan remaining sheets
    // EXCLUDE: Database, Master Data, Rekap, and monthly sheets (01-12) — these are
    // production sheets that have "Jenis Wadah" but NOT RTP/Pembudidaya columns.
    // The strict parsePopulasiSheet will also reject them, but we skip here for efficiency.
    if (populasiRows.length === 0) {
      console.warn(
        '[analyze/upload] Populasi parsing yielded 0 rows from primary sheet, scanning other sheets as fallback...'
      );
      for (const sheetName of workbook.SheetNames) {
        if (populasiRows.length > 0) break;
        const lower = sheetName.toLowerCase();
        // Skip production/data sheets — they don't contain populasi (RTP/Pembudidaya) data
        if (lower === 'database' || lower === 'master data' || lower.startsWith('rekap')) continue;
        // Skip monthly sheets (01, 02, ..., 12) — they are production sheets
        if (/^\d{1,2}$/.test(sheetName.trim())) continue;
        // Skip the primary populasi sheet (already tried)
        if (lower.includes('data populasi')) continue;
        const count = parsePopulasiSheet(sheetName);
        if (count > 0) {
          console.log(`[analyze/upload] Fallback: found populasi data in sheet "${sheetName}" (${count} rows)`);
        }
      }
    }

    console.log(
      `[analyze/upload] Populasi parsing complete: ${populasiRows.length} rows total`
    );

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
