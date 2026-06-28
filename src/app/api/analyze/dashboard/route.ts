import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

const fmtNum = (n: number) => Math.round(n * 100) / 100;

// Month labels for display
const BULAN_LABELS: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',
  5: 'Mei', 6: 'Jun', 7: 'Jul', 8: 'Agu',
  9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Des',
};

// Triwulan label from tw number
const TW_LABELS: Record<number, string> = {
  1: 'TW 1', 2: 'TW 2', 3: 'TW 3', 4: 'TW 4',
};

// Map Q1-Q4 to semester
function triwulanToSemester(tw: string): number {
  const q = tw.toUpperCase().replace('Q', '');
  const num = parseInt(q, 10);
  if (num <= 2) return 1;
  return 2;
}

// Map Q1-Q4 to tw number (1-4)
function triwulanToTwNum(tw: string): number {
  const q = tw.toUpperCase().replace('Q', '');
  return parseInt(q, 10) || 1;
}

// Tw number to semester
function twToSemester(tw: number): number {
  return tw <= 2 ? 1 : 2;
}

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();

    const { searchParams } = request.nextUrl;
    const yearParam = searchParams.get('year');
    const semesterParam = searchParams.get('semester');

    if (!yearParam) {
      return NextResponse.json(
        { error: 'year query parameter is required' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      return NextResponse.json(
        { error: 'year must be a valid number' },
        { status: 400 }
      );
    }

    const semester = semesterParam ? parseInt(semesterParam, 10) : undefined;
    if (semester !== undefined && semester !== 1 && semester !== 2) {
      return NextResponse.json(
        { error: 'semester must be 1 or 2' },
        { status: 400 }
      );
    }

    // ============================================================
    // 1. Gather available years & semesters from both sources
    // Using findMany without distinct (Turso adapter workaround)
    // ============================================================
    const [uploadYearsAll, disaggYearsAll] = await Promise.all([
      db.analyzeUpload.findMany({
        select: { year: true, semester: true },
        orderBy: { year: 'asc' },
      }).catch(() => []),
      db.disaggregationBatch.findMany({
        select: { year: true, triwulan: true },
        orderBy: { year: 'asc' },
      }).catch(() => []),
    ]);

    // Dedupe in JS (avoid distinct query that crashes Turso adapter)
    const yearSet = new Set<number>();
    const semesterSet = new Set<number>();
    const seenUpload = new Set<string>();
    for (const u of uploadYearsAll) {
      const key = `${u.year}-${u.semester}`;
      if (seenUpload.has(key)) continue;
      seenUpload.add(key);
      yearSet.add(u.year);
      if (u.semester && u.semester > 0) semesterSet.add(u.semester);
    }
    const seenDisagg = new Set<string>();
    for (const d of disaggYearsAll) {
      const key = `${d.year}-${d.triwulan}`;
      if (seenDisagg.has(key)) continue;
      seenDisagg.add(key);
      yearSet.add(d.year);
      const sem = triwulanToSemester(d.triwulan);
      semesterSet.add(sem);
    }

    const availableYears = Array.from(yearSet).sort((a, b) => a - b);
    const availableSemesters = Array.from(semesterSet).sort((a, b) => a - b);

    // ============================================================
    // 2. Try upload source first
    // ============================================================
    let uploads = await db.analyzeUpload.findMany({
      where: { year },
      include: {
        rows: true,
        populasi: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Apply semester filter on uploads if specified
    if (semester !== undefined && uploads.length > 0) {
      // Filter rows by semester within each upload
      uploads = uploads.map((u) => ({
        ...u,
        rows: u.rows.filter((r) => r.semester === semester),
        populasi: u.populasi, // populasi is per-upload, not per-semester
      }));
    }

    const allRows = uploads.flatMap((u) => u.rows);
    const allPopulasi = uploads.flatMap((u) => u.populasi);

    if (allRows.length > 0) {
      // ============================================================
      // UPLOAD SOURCE — compute dashboard data from AnalyzeRow
      // ============================================================
      return NextResponse.json(
        buildUploadResponse(year, semester, 'upload', true, availableYears, availableSemesters, allRows, allPopulasi)
      );
    }

    // ============================================================
    // 3. Fallback to disaggregation source
    // ============================================================
    const batches = await db.disaggregationBatch.findMany({
      where: { year },
      include: { fishFarms: true },
      orderBy: { createdAt: 'desc' },
    });

    // Apply semester filter on batches if specified
    let filteredBatches = batches;
    if (semester !== undefined) {
      filteredBatches = batches.filter((b) => triwulanToSemester(b.triwulan) === semester);
    }

    const allFishFarms = filteredBatches.flatMap((b) => b.fishFarms);

    if (allFishFarms.length > 0) {
      return NextResponse.json(
        buildDisaggResponse(year, semester, 'disaggregation', true, availableYears, availableSemesters, filteredBatches, allFishFarms)
      );
    }

    // ============================================================
    // 4. No data found
    // ============================================================
    return NextResponse.json({
      year,
      semester: semester ?? null,
      source: 'none',
      hasData: false,
      availableYears,
      availableSemesters,
      summary: {
        totalProduksiTon: 0,
        totalNilaiRp: 0,
        totalNilaiMiliar: 0,
        totalRtp: 0,
        totalPembudidaya: 0,
        totalLuasLahan: 0,
      },
      monthlyData: [],
      monthlyByKomoditas: [],
      triwulanData: [],
      komoditasData: [],
      wadahData: [],
      matrixData: [],
      productivityData: [],
      insights: [],
    });
  } catch (error) {
    console.error('[analyze/dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

// ============================================================
// Build response from upload source (AnalyzeRow + AnalyzePopulasi)
// ============================================================
function buildUploadResponse(
  year: number,
  semester: number | undefined,
  source: 'upload',
  hasData: true,
  availableYears: number[],
  availableSemesters: number[],
  rows: {
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
  }[],
  populasi: {
    jenisWadah: string;
    jumlahRtp: number;
    jumlahPembudidaya: number;
    luasLahan: number;
  }[]
) {
  // --- Summary ---
  const totalProduksiTon = fmtNum(rows.reduce((s, r) => s + r.produksiTon, 0));
  const totalNilaiRp = rows.reduce((s, r) => s + r.nilaiRp, 0);
  const totalNilaiMiliar = fmtNum(totalNilaiRp / 1_000_000_000);
  const totalRtp = populasi.reduce((s, p) => s + p.jumlahRtp, 0);
  const totalPembudidaya = populasi.reduce((s, p) => s + p.jumlahPembudidaya, 0);
  const totalLuasLahan = fmtNum(populasi.reduce((s, p) => s + p.luasLahan, 0));

  // --- Monthly data ---
  const monthlyMap = new Map<number, { produksi: number; nilai: number; tw: number }>();
  for (const r of rows) {
    const existing = monthlyMap.get(r.bulanNum) || { produksi: 0, nilai: 0, tw: r.tw };
    existing.produksi += r.produksiTon;
    existing.nilai += r.nilaiRp;
    existing.tw = r.tw;
    monthlyMap.set(r.bulanNum, existing);
  }
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([bulanNum, d]) => ({
      bulan: BULAN_LABELS[bulanNum] || `B${bulanNum}`,
      bulanNum,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000), // in juta
      tw: TW_LABELS[d.tw] || `TW ${d.tw}`,
    }));

  // --- Monthly by Komoditas (pivot for bar+line chart) ---
  // Each entry: { bulan, bulanNum, [komoditas1]: ton, [komoditas2]: ton, ..., total: ton }
  const monthlyKomMap = new Map<number, Map<string, number>>(); // bulanNum -> (komoditas -> produksiTon)
  for (const r of rows) {
    if (!monthlyKomMap.has(r.bulanNum)) monthlyKomMap.set(r.bulanNum, new Map());
    const kMap = monthlyKomMap.get(r.bulanNum)!;
    kMap.set(r.komoditas, (kMap.get(r.komoditas) || 0) + r.produksiTon);
  }
  const monthlyByKomoditas = Array.from(monthlyKomMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([bulanNum, kMap]) => {
      const entry: Record<string, string | number> = {
        bulan: BULAN_LABELS[bulanNum] || `B${bulanNum}`,
        bulanNum,
      };
      let total = 0;
      for (const [k, v] of kMap.entries()) {
        entry[k] = fmtNum(v);
        total += v;
      }
      entry.total = fmtNum(total);
      return entry;
    });

  // --- Triwulan data ---
  const twMap = new Map<number, { produksi: number; nilai: number }>();
  for (const r of rows) {
    const existing = twMap.get(r.tw) || { produksi: 0, nilai: 0 };
    existing.produksi += r.produksiTon;
    existing.nilai += r.nilaiRp;
    twMap.set(r.tw, existing);
  }
  const triwulanData = Array.from(twMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([tw, d]) => ({
      name: TW_LABELS[tw] || `TW ${tw}`,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000), // in juta
    }));

  // --- Komoditas data ---
  const komoditasMap = new Map<string, { produksi: number; nilai: number; pakan: number; benih: number }>();
  for (const r of rows) {
    const existing = komoditasMap.get(r.komoditas) || { produksi: 0, nilai: 0, pakan: 0, benih: 0 };
    existing.produksi += r.produksiTon;
    existing.nilai += r.nilaiRp;
    existing.pakan += r.pakanKg;
    existing.benih += r.agregatBenih;
    komoditasMap.set(r.komoditas, existing);
  }
  const totalProduksiForPct = rows.reduce((s, r) => s + r.produksiTon, 0) || 1;
  const komoditasData = Array.from(komoditasMap.entries())
    .sort(([, a], [, b]) => b.produksi - a.produksi)
    .map(([name, d]) => ({
      name,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000), // in juta
      pakan: fmtNum(d.pakan),
      benih: fmtNum(d.benih),
      pct: fmtNum((d.produksi / totalProduksiForPct) * 100),
    }));

  // --- Wadah data ---
  // Production data from rows
  const wadahProdMap = new Map<string, { produksi: number; nilai: number }>();
  for (const r of rows) {
    const existing = wadahProdMap.get(r.jenisWadah) || { produksi: 0, nilai: 0 };
    existing.produksi += r.produksiTon;
    existing.nilai += r.nilaiRp;
    wadahProdMap.set(r.jenisWadah, existing);
  }
  // Populasi data from AnalyzePopulasi
  const wadahPopMap = new Map<string, { rtp: number; pembudidaya: number; luasLahan: number }>();
  for (const p of populasi) {
    const existing = wadahPopMap.get(p.jenisWadah) || { rtp: 0, pembudidaya: 0, luasLahan: 0 };
    existing.rtp += p.jumlahRtp;
    existing.pembudidaya += p.jumlahPembudidaya;
    existing.luasLahan += p.luasLahan;
    wadahPopMap.set(p.jenisWadah, existing);
  }
  const wadahTotalProduksi = rows.reduce((s, r) => s + r.produksiTon, 0) || 1;
  const wadahData = Array.from(wadahProdMap.entries())
    .sort(([, a], [, b]) => b.produksi - a.produksi)
    .map(([name, d]) => {
      const pop = wadahPopMap.get(name) || { rtp: 0, pembudidaya: 0, luasLahan: 0 };
      return {
        name,
        produksi: fmtNum(d.produksi),
        nilai: fmtNum(d.nilai / 1_000_000), // in juta
        pct: fmtNum((d.produksi / wadahTotalProduksi) * 100),
        rtp: pop.rtp,
        pembudidaya: pop.pembudidaya,
        luasLahan: fmtNum(pop.luasLahan),
      };
    });

  // --- Matrix data (komoditas × jenisWadah pivot) ---
  const komoditasSet = new Set<string>();
  const wadahSet = new Set<string>();
  for (const r of rows) {
    komoditasSet.add(r.komoditas);
    wadahSet.add(r.jenisWadah);
  }
  const komoditasList = Array.from(komoditasSet).sort();
  const wadahList = Array.from(wadahSet).sort();

  const matrixMap = new Map<string, number>(); // key: "komoditas|wadah" -> produksiTon
  for (const r of rows) {
    const key = `${r.komoditas}|${r.jenisWadah}`;
    matrixMap.set(key, (matrixMap.get(key) || 0) + r.produksiTon);
  }

  const matrixData = komoditasList.map((komoditas) => {
    const entry: Record<string, string | number> = { komoditas };
    for (const wadah of wadahList) {
      const key = `${komoditas}|${wadah}`;
      entry[wadah] = fmtNum(matrixMap.get(key) || 0);
    }
    return entry;
  });

  // --- Productivity data (komoditas × jenisWadah, avg produktifitas) ---
  const prodMap = new Map<string, { sum: number; count: number }>(); // key: "komoditas|wadah" -> {sum, count}
  for (const r of rows) {
    if (r.produktifitas > 0) {
      const key = `${r.komoditas}|${r.jenisWadah}`;
      const existing = prodMap.get(key) || { sum: 0, count: 0 };
      existing.sum += r.produktifitas;
      existing.count += 1;
      prodMap.set(key, existing);
    }
  }

  const productivityData = komoditasList.map((komoditas) => {
    const entry: Record<string, string | number> = { name: komoditas };
    for (const wadah of wadahList) {
      const key = `${komoditas}|${wadah}`;
      const data = prodMap.get(key);
      entry[wadah] = data ? fmtNum(data.sum / data.count) : 0;
    }
    return entry;
  });

  // --- Insights ---
  const insights = generateInsights(monthlyData, komoditasData, wadahData, productivityData, wadahList);

  return {
    year,
    semester: semester ?? null,
    source,
    hasData,
    availableYears,
    availableSemesters,
    summary: {
      totalProduksiTon,
      totalNilaiRp,
      totalNilaiMiliar,
      totalRtp,
      totalPembudidaya,
      totalLuasLahan,
    },
    monthlyData,
    monthlyByKomoditas,
    triwulanData,
    komoditasData,
    wadahData,
    matrixData,
    productivityData,
    insights,
  };
}

// ============================================================
// Build response from disaggregation source (DisaggregationBatch + FishFarm)
// ============================================================
function buildDisaggResponse(
  year: number,
  semester: number | undefined,
  source: 'disaggregation',
  hasData: true,
  availableYears: number[],
  availableSemesters: number[],
  batches: {
    triwulan: string;
    fishFarms: {
      productionQty: number;
      fishType: string;
      containerType: string;
      rtpCount: number;
      farmerCount: number;
      productionValue: number;
    }[];
  }[],
  allFishFarms: {
    productionQty: number;
    fishType: string;
    containerType: string;
    rtpCount: number;
    farmerCount: number;
    productionValue: number;
    triwulan: string;
  }[]
) {
  // --- Summary ---
  const totalProduksiTon = fmtNum(allFishFarms.reduce((s, f) => s + f.productionQty, 0) / 1000); // kg to ton
  const totalNilaiRp = allFishFarms.reduce((s, f) => s + f.productionValue, 0);
  const totalNilaiMiliar = fmtNum(totalNilaiRp / 1_000_000_000);
  const totalRtp = allFishFarms.reduce((s, f) => s + f.rtpCount, 0);
  const totalPembudidaya = allFishFarms.reduce((s, f) => s + f.farmerCount, 0);
  const totalLuasLahan = 0; // Not available in disaggregation data

  // --- Monthly/Triwulan data ---
  // Disaggregation only has triwulan, not monthly, so we map triwulan to approximate months
  const twMap = new Map<string, { produksi: number; nilai: number }>();
  for (const batch of batches) {
    const existing = twMap.get(batch.triwulan) || { produksi: 0, nilai: 0 };
    for (const ff of batch.fishFarms) {
      existing.produksi += ff.productionQty / 1000; // kg to ton
      existing.nilai += ff.productionValue;
    }
    twMap.set(batch.triwulan, existing);
  }

  const triwulanData = Array.from(twMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tw, d]) => ({
      name: `TW ${triwulanToTwNum(tw)}`,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000),
    }));

  // Monthly approximation: distribute each triwulan evenly across its 3 months
  const monthToTriwulan: Record<number, string> = {
    1: 'Q1', 2: 'Q1', 3: 'Q1',
    4: 'Q2', 5: 'Q2', 6: 'Q2',
    7: 'Q3', 8: 'Q3', 9: 'Q3',
    10: 'Q4', 11: 'Q4', 12: 'Q4',
  };

  const monthlyData: { bulan: string; bulanNum: number; produksi: number; nilai: number; tw: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const qLabel = monthToTriwulan[m];
    const twData = twMap.get(qLabel);
    if (twData) {
      monthlyData.push({
        bulan: BULAN_LABELS[m],
        bulanNum: m,
        produksi: fmtNum(twData.produksi / 3),
        nilai: fmtNum(twData.nilai / 3 / 1_000_000),
        tw: `TW ${triwulanToTwNum(qLabel)}`,
      });
    }
  }

  // --- Monthly by Komoditas (distribute per-komoditas per-triwulan across 3 months) ---
  const twKomMap = new Map<string, Map<string, number>>(); // triwulan -> (komoditas -> produksiTon)
  for (const batch of batches) {
    if (!twKomMap.has(batch.triwulan)) twKomMap.set(batch.triwulan, new Map());
    const kMap = twKomMap.get(batch.triwulan)!;
    for (const ff of batch.fishFarms) {
      kMap.set(ff.fishType, (kMap.get(ff.fishType) || 0) + ff.productionQty / 1000);
    }
  }
  const monthlyByKomoditas: Record<string, string | number>[] = [];
  for (let m = 1; m <= 12; m++) {
    const qLabel = monthToTriwulan[m];
    const kMap = twKomMap.get(qLabel);
    if (kMap) {
      const entry: Record<string, string | number> = {
        bulan: BULAN_LABELS[m],
        bulanNum: m,
      };
      let total = 0;
      for (const [k, v] of kMap.entries()) {
        entry[k] = fmtNum(v / 3); // distribute triwulan total across 3 months
        total += v / 3;
      }
      entry.total = fmtNum(total);
      monthlyByKomoditas.push(entry);
    }
  }

  // --- Komoditas data ---
  const komoditasMap = new Map<string, { produksi: number; nilai: number }>();
  for (const ff of allFishFarms) {
    const existing = komoditasMap.get(ff.fishType) || { produksi: 0, nilai: 0 };
    existing.produksi += ff.productionQty / 1000; // kg to ton
    existing.nilai += ff.productionValue;
    komoditasMap.set(ff.fishType, existing);
  }
  const totalProduksiForPct = allFishFarms.reduce((s, f) => s + f.productionQty, 0) / 1000 || 1;
  const komoditasData = Array.from(komoditasMap.entries())
    .sort(([, a], [, b]) => b.produksi - a.produksi)
    .map(([name, d]) => ({
      name,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000),
      pakan: 0, // Not available in disaggregation
      benih: 0, // Not available in disaggregation
      pct: fmtNum((d.produksi / totalProduksiForPct) * 100),
    }));

  // --- Wadah data ---
  const wadahProdMap = new Map<string, { produksi: number; nilai: number; rtp: number; pembudidaya: number }>();
  for (const ff of allFishFarms) {
    const existing = wadahProdMap.get(ff.containerType) || { produksi: 0, nilai: 0, rtp: 0, pembudidaya: 0 };
    existing.produksi += ff.productionQty / 1000;
    existing.nilai += ff.productionValue;
    existing.rtp += ff.rtpCount;
    existing.pembudidaya += ff.farmerCount;
    wadahProdMap.set(ff.containerType, existing);
  }
  const wadahTotalProduksi = allFishFarms.reduce((s, f) => s + f.productionQty, 0) / 1000 || 1;
  const wadahData = Array.from(wadahProdMap.entries())
    .sort(([, a], [, b]) => b.produksi - a.produksi)
    .map(([name, d]) => ({
      name,
      produksi: fmtNum(d.produksi),
      nilai: fmtNum(d.nilai / 1_000_000),
      pct: fmtNum((d.produksi / wadahTotalProduksi) * 100),
      rtp: d.rtp,
      pembudidaya: d.pembudidaya,
      luasLahan: 0, // Not available in disaggregation
    }));

  // --- Matrix data (komoditas × containerType pivot) ---
  const komoditasSet = new Set<string>();
  const wadahSet = new Set<string>();
  for (const ff of allFishFarms) {
    komoditasSet.add(ff.fishType);
    wadahSet.add(ff.containerType);
  }
  const komoditasList = Array.from(komoditasSet).sort();
  const wadahList = Array.from(wadahSet).sort();

  const matrixMap = new Map<string, number>();
  for (const ff of allFishFarms) {
    const key = `${ff.fishType}|${ff.containerType}`;
    matrixMap.set(key, (matrixMap.get(key) || 0) + ff.productionQty / 1000);
  }

  const matrixData = komoditasList.map((komoditas) => {
    const entry: Record<string, string | number> = { komoditas };
    for (const wadah of wadahList) {
      const key = `${komoditas}|${wadah}`;
      entry[wadah] = fmtNum(matrixMap.get(key) || 0);
    }
    return entry;
  });

  // --- Productivity data ---
  // Not available in disaggregation, return zeros
  const productivityData = komoditasList.map((komoditas) => {
    const entry: Record<string, string | number> = { name: komoditas };
    for (const wadah of wadahList) {
      entry[wadah] = 0;
    }
    return entry;
  });

  // --- Insights ---
  const insights = generateDisaggInsights(komoditasData, wadahData);

  return {
    year,
    semester: semester ?? null,
    source,
    hasData,
    availableYears,
    availableSemesters,
    summary: {
      totalProduksiTon,
      totalNilaiRp,
      totalNilaiMiliar,
      totalRtp,
      totalPembudidaya,
      totalLuasLahan,
    },
    monthlyData,
    monthlyByKomoditas,
    triwulanData,
    komoditasData,
    wadahData,
    matrixData,
    productivityData,
    insights,
  };
}

// ============================================================
// Insight generators
// ============================================================
function generateInsights(
  monthlyData: { bulan: string; produksi: number }[],
  komoditasData: { name: string; produksi: number; pct: number }[],
  wadahData: { name: string; produksi: number; pct: number; rtp: number; pembudidaya: number }[],
  productivityData: Record<string, string | number>[],
  wadahList: string[]
): { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[] {
  const insights: { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[] = [];

  // 1. Biggest month-over-month drop > 10%
  if (monthlyData.length >= 2) {
    let biggestDrop = { month: '', pctDrop: 0, prevProduksi: 0, currProduksi: 0 };
    for (let i = 1; i < monthlyData.length; i++) {
      const prev = monthlyData[i - 1].produksi;
      const curr = monthlyData[i].produksi;
      if (prev > 0) {
        const dropPct = ((prev - curr) / prev) * 100;
        if (dropPct > biggestDrop.pctDrop) {
          biggestDrop = { month: monthlyData[i].bulan, pctDrop: dropPct, prevProduksi: prev, currProduksi: curr };
        }
      }
    }
    if (biggestDrop.pctDrop > 10) {
      insights.push({
        title: 'Penurunan Produksi Signifikan',
        desc: `Produksi turun ${fmtNum(biggestDrop.pctDrop)}% pada ${biggestDrop.month} (${fmtNum(biggestDrop.prevProduksi)} → ${fmtNum(biggestDrop.currProduksi)} ton). Perlu investigasi faktor penyebab.`,
        severity: 'high',
      });
    }
  }

  // 2. Komoditas with > 50% share
  if (komoditasData.length > 0) {
    const dominant = komoditasData[0]; // Already sorted by production desc
    if (dominant.pct > 50) {
      insights.push({
        title: 'Dominasi Komoditas — Diversifikasi Diperlukan',
        desc: `${dominant.name} mendominasi ${fmtNum(dominant.pct)}% total produksi. Konsentrasi tinggi meningkatkan risiko kerentanan terhadap fluktuasi harga dan penyakit.`,
        severity: 'medium',
      });
    }
  }

  // 3. Wadah with highest productivity
  if (productivityData.length > 0 && wadahList.length > 0) {
    let bestWadah = '';
    let bestProd = 0;
    let bestKomoditas = '';
    for (const row of productivityData) {
      for (const wadah of wadahList) {
        const val = typeof row[wadah] === 'number' ? row[wadah] as number : 0;
        if (val > bestProd) {
          bestProd = val;
          bestWadah = wadah;
          bestKomoditas = row.name as string;
        }
      }
    }
    if (bestProd > 0) {
      insights.push({
        title: 'Wadah Paling Produktif',
        desc: `${bestWadah} menunjukkan produktivitas tertinggi (${fmtNum(bestProd)} kg/m²) untuk komoditas ${bestKomoditas}. Dapat dijadikan model untuk perluasan.`,
        severity: 'low',
      });
    }
  }

  // 4. Wadah with most RTP but relatively low production
  if (wadahData.length >= 2) {
    const sortedByRtp = [...wadahData].sort((a, b) => b.rtp - a.rtp);
    const topRtp = sortedByRtp[0];
    const topProd = wadahData[0]; // Highest production
    if (topRtp.name !== topProd.name && topRtp.rtp > 0) {
      insights.push({
        title: 'Potensi Peningkatan Produksi',
        desc: `${topRtp.name} memiliki RTP terbanyak (${topRtp.rtp}) namun produksi bukan yang tertinggi. Intervensi teknis dapat meningkatkan output secara signifikan.`,
        severity: 'medium',
      });
    }
  }

  // 5. Always add disaggregation insight
  insights.push({
    title: 'Disagregasi ke Level Desa Diperlukan',
    desc: 'Data saat ini masih pada level agregat. Disagregasi ke level desa memungkinkan penargetan program yang lebih presisi dan pengukuran dampak yang akurat.',
    severity: 'low',
  });

  return insights;
}

function generateDisaggInsights(
  komoditasData: { name: string; pct: number }[],
  wadahData: { name: string; pct: number }[]
): { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[] {
  const insights: { title: string; desc: string; severity: 'high' | 'medium' | 'low' }[] = [];

  // Dominant komoditas
  if (komoditasData.length > 0 && komoditasData[0].pct > 50) {
    insights.push({
      title: 'Dominasi Komoditas — Diversifikasi Diperlukan',
      desc: `${komoditasData[0].name} mendominasi ${fmtNum(komoditasData[0].pct)}% total produksi. Konsentrasi tinggi meningkatkan risiko kerentanan.`,
      severity: 'medium',
    });
  }

  // Dominant wadah
  if (wadahData.length > 0 && wadahData[0].pct > 70) {
    insights.push({
      title: 'Konsentrasi Wadah Budidaya',
      desc: `${wadahData[0].name} menyumbang ${fmtNum(wadahData[0].pct)}% produksi. Perlu diversifikasi wadah budidaya untuk mengurangi risiko.`,
      severity: 'low',
    });
  }

  // Always add
  insights.push({
    title: 'Disagregasi ke Level Desa Diperlukan',
    desc: 'Data disagregasi tersedia. Analisis mendalam ke level desa dapat membantu penargetan program yang lebih presisi.',
    severity: 'low',
  });

  return insights;
}
