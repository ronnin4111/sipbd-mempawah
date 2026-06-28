/**
 * One-time script: re-parse the uploaded Excel file with the new header-based
 * parser and replace the corrupt AnalyzeRow/AnalyzePopulasi data in Turso.
 *
 * Usage: bun run scripts/reparse-analyze.ts
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import { db } from '../src/lib/db';

const BULAN_MAP: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const toNumber = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const toInt = (v: unknown) => Math.round(toNumber(v));
const getSemester = (b: number) => (b <= 6 ? 1 : 2);
const getTriwulan = (b: number) => Math.ceil(b / 3);
const normalizeHeader = (v: unknown) => toStr(v).toLowerCase().replace(/\s+/g, ' ').trim();

function detectRowField(norm: string): string | null {
  if (norm === 'bulan') return 'bulan';
  if (norm === 'tw' || norm === 'triwulan') return 'tw';
  if (norm === 'semester' || norm === 'sem') return 'semester';
  if (norm === 'jenis wadah') return 'jenisWadah';
  if (norm === 'komoditas') return 'komoditas';
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

function detectPopulasiField(norm: string): string | null {
  if (norm.includes('jenis wadah')) return 'jenisWadah';
  if (norm.includes('rtp')) return 'jumlahRtp';
  if (norm.includes('pembudidaya')) return 'jumlahPembudidaya';
  if (norm.includes('luas lahan') || norm.includes('luas')) return 'luasLahan';
  return null;
}

function findHeaderRow(data: unknown[][], kws: string[], maxScan = 15): number {
  for (let i = 0; i < Math.min(data.length, maxScan); i++) {
    const row = data[i] || [];
    const norms = row.map((c) => normalizeHeader(c));
    if (kws.every((kw) => norms.some((n) => n.includes(kw)))) return i;
  }
  return -1;
}

function buildColumnMap(headerRow: unknown[], detector: (n: string) => string | null): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const field = detector(normalizeHeader(cell));
    if (field && map[field] === undefined) map[field] = idx;
  });
  return map;
}

async function main() {
  const filePath = '/home/z/my-project/upload/Pembesaran_Mempawah (1).xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  // --- Year from Rekap Produksi ---
  const rekapName = wb.SheetNames.find((n) => n.toLowerCase().includes('rekap produksi'));
  let year = 0;
  if (rekapName) {
    const rk: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[rekapName], { header: 1 });
    const cell = toStr(rk[0]?.[2]);
    const m = cell.match(/(\d{4})/);
    if (m) year = parseInt(m[1], 10);
  }
  if (!year) year = new Date().getFullYear();
  console.log('Detected year:', year);

  // --- Parse Database sheet (header-based) ---
  const dbName = wb.SheetNames.find((n) => n.toLowerCase() === 'database');
  if (!dbName) { console.error('No Database sheet'); process.exit(1); }
  const dbRaw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[dbName], { header: 1 });
  const dbHeaderIdx = findHeaderRow(dbRaw, ['bulan', 'komoditas', 'jenis wadah'], 15);
  console.log('Database header row idx:', dbHeaderIdx);
  const colMap = dbHeaderIdx >= 0
    ? buildColumnMap(dbRaw[dbHeaderIdx], detectRowField)
    : { bulan: 4, tw: 5, semester: 6, jenisWadah: 7, komoditas: 8, produksiTon: 9, produksiKg: 10, produktifitas: 11, luasLahan: 12, hargaRpKg: 13, nilaiRp: 14, fcr: 15, pakanKg: 16, size: 17, sr: 18, agregatBenih: 19 };
  console.log('Column map:', colMap);
  const dbStart = dbHeaderIdx >= 0 ? dbHeaderIdx + 1 : 4;

  const analyzeRows: any[] = [];
  for (const row of dbRaw.slice(dbStart)) {
    if (!row || row.length === 0) continue;
    const komoditas = toStr(row[colMap.komoditas ?? 8]);
    if (!komoditas || komoditas.toUpperCase() === 'TOTAL') continue;
    const bulanStr = toStr(row[colMap.bulan ?? 4]);
    const bulanNum = BULAN_MAP[bulanStr.toLowerCase()] || toInt(row[colMap.bulan ?? 4]) || 1;
    analyzeRows.push({
      bulan: bulanStr, bulanNum,
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
  console.log('Parsed analyze rows:', analyzeRows.length);
  console.log('Sample row 0:', analyzeRows[0]);
  console.log('Distinct komoditas:', [...new Set(analyzeRows.map((r) => r.komoditas))]);
  console.log('Distinct bulan:', [...new Set(analyzeRows.map((r) => r.bulan))]);
  const totalTon = analyzeRows.reduce((s, r) => s + r.produksiTon, 0);
  console.log('Total produksi (Ton):', Math.round(totalTon * 100) / 100);

  // --- Parse Data Populasi sheet (header-based) ---
  const popName = wb.SheetNames.find((n) => n.toLowerCase().includes('data populasi'));
  const populasiRows: any[] = [];
  if (popName) {
    const popRaw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[popName], { header: 1 });
    const popHeaderIdx = findHeaderRow(popRaw, ['jenis wadah', 'rtp'], 10);
    console.log('Populasi header row idx:', popHeaderIdx);
    const popColMap = popHeaderIdx >= 0
      ? buildColumnMap(popRaw[popHeaderIdx], detectPopulasiField)
      : { jenisWadah: 2, jumlahRtp: 3, jumlahPembudidaya: 4, luasLahan: 5 };
    console.log('Populasi col map:', popColMap);
    const popStart = popHeaderIdx >= 0 ? popHeaderIdx + 1 : 5;
    for (const row of popRaw.slice(popStart)) {
      if (!row || row.length === 0) continue;
      const jenisWadah = toStr(row[popColMap.jenisWadah ?? 2]);
      if (!jenisWadah || jenisWadah.toUpperCase() === 'TOTAL') continue;
      populasiRows.push({
        jenisWadah,
        jumlahRtp: toInt(row[popColMap.jumlahRtp ?? 3]),
        jumlahPembudidaya: toInt(row[popColMap.jumlahPembudidaya ?? 4]),
        luasLahan: toNumber(row[popColMap.luasLahan ?? 5]),
      });
    }
  }
  console.log('Parsed populasi rows:', populasiRows.length);
  console.log('Populasi sample:', populasiRows);

  // --- Replace data in Turso ---
  console.log('\n--- Replacing data in Turso ---');
  const existing = await db.analyzeUpload.findMany({ where: { year }, select: { id: true } });
  console.log('Existing uploads to delete:', existing.length);
  for (const e of existing) {
    await db.analyzeUpload.delete({ where: { id: e.id } });
  }

  const upload = await db.analyzeUpload.create({
    data: {
      year,
      semester: 0,
      fileName: 'Pembesaran_Mempawah (1).xlsx',
      fileSize: fs.statSync(filePath).size,
      businessType: 'Pembesaran',
      uploadedBy: 'admin-reparse',
    },
  });
  console.log('Created upload:', upload.id);

  // Insert rows in batches
  const BATCH = 50;
  for (let i = 0; i < analyzeRows.length; i += BATCH) {
    const batch = analyzeRows.slice(i, i + BATCH);
    await db.analyzeRow.createMany({ data: batch.map((r) => ({ uploadId: upload.id, ...r })) });
  }
  console.log('Inserted', analyzeRows.length, 'rows');

  if (populasiRows.length > 0) {
    for (let i = 0; i < populasiRows.length; i += BATCH) {
      const batch = populasiRows.slice(i, i + BATCH);
      await db.analyzePopulasi.createMany({ data: batch.map((r) => ({ uploadId: upload.id, ...r })) });
    }
    console.log('Inserted', populasiRows.length, 'populasi rows');
  }

  await db.$disconnect();
  console.log('\n✅ Done. Data re-parsed and stored in Turso.');
}

main().catch((e) => { console.error(e); process.exit(1); });
