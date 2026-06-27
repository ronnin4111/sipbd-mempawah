import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

// Valid triwulan values in order
const TRIWULANS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
type Triwulan = (typeof TRIWULANS)[number];

interface TriwulanStatus {
  hasData: boolean;
  batchCount: number;
  totalQty: number;
  farmerCount: number;
  businessTypes: string[];
  kecamatanList: string[];
  fishTypes: string[];
  containerTypes: string[];
  lastBatchAt: string | null;
}

interface SemesterStatus {
  hasData: boolean;
  totalQty: number;
  farmerCount: number;
  triwulansWithData: string[];
}

function emptyTriwulanStatus(): TriwulanStatus {
  return {
    hasData: false,
    batchCount: 0,
    totalQty: 0,
    farmerCount: 0,
    businessTypes: [],
    kecamatanList: [],
    fishTypes: [],
    containerTypes: [],
    lastBatchAt: null,
  };
}

/**
 * GET /api/disagregasi/triwulan-status?year=2025
 *
 * Returns the status of disaggregation batches per triwulan for a given year,
 * along with semester aggregates.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (!yearParam) {
      return NextResponse.json(
        { error: 'Parameter year wajib diisi' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json(
        { error: 'Parameter year tidak valid' },
        { status: 400 }
      );
    }

    // Fetch all disaggregation batches for the given year, including their fish farms
    const batches = await db.disaggregationBatch.findMany({
      where: { year },
      include: {
        fishFarms: {
          select: {
            id: true,
            farmerCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group batches by triwulan
    const batchesByTriwulan = new Map<Triwulan, typeof batches>();

    for (const triwulan of TRIWULANS) {
      batchesByTriwulan.set(triwulan, []);
    }

    for (const batch of batches) {
      const tw = batch.triwulan as Triwulan;
      if (TRIWULANS.includes(tw)) {
        batchesByTriwulan.get(tw)!.push(batch);
      }
    }

    // Build triwulan status map
    const triwulans: Record<string, TriwulanStatus> = {};

    for (const triwulan of TRIWULANS) {
      const triwulanBatches = batchesByTriwulan.get(triwulan)!;

      if (triwulanBatches.length === 0) {
        triwulans[triwulan] = emptyTriwulanStatus();
        continue;
      }

      const batchCount = triwulanBatches.length;
      const totalQty = triwulanBatches.reduce((sum, b) => sum + b.totalQty, 0);

      // Count unique fish farms across all batches in this triwulan
      let farmerCount = 0;
      for (const batch of triwulanBatches) {
        farmerCount += batch.fishFarms.length;
      }

      // Collect unique values for each category across all batches
      const businessTypesSet = new Set<string>();
      const kecamatanSet = new Set<string>();
      const fishTypesSet = new Set<string>();
      const containerTypesSet = new Set<string>();

      for (const batch of triwulanBatches) {
        // Batches store comma-separated values for kecamatan, fishType, containerType
        batch.businessType.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => businessTypesSet.add(v));
        batch.kecamatan.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => kecamatanSet.add(v));
        batch.fishType.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => fishTypesSet.add(v));
        batch.containerType.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => containerTypesSet.add(v));
      }

      // Find the most recent createdAt across all batches
      const lastBatchAt = triwulanBatches.reduce<(string | null)>((latest, batch) => {
        if (!latest) return batch.createdAt.toISOString();
        return batch.createdAt.toISOString() > latest ? batch.createdAt.toISOString() : latest;
      }, null);

      triwulans[triwulan] = {
        hasData: true,
        batchCount,
        totalQty: Math.round(totalQty * 100) / 100,
        farmerCount,
        businessTypes: Array.from(businessTypesSet).sort(),
        kecamatanList: Array.from(kecamatanSet).sort(),
        fishTypes: Array.from(fishTypesSet).sort(),
        containerTypes: Array.from(containerTypesSet).sort(),
        lastBatchAt,
      };
    }

    // Compute semester aggregates
    const semesters: Record<string, SemesterStatus> = {};

    // Semester 1 = Q1 + Q2
    const s1Triwulans: Triwulan[] = ['Q1', 'Q2'];
    const s1TriwulansWithData = s1Triwulans.filter((tw) => triwulans[tw]?.hasData);
    const s1TotalQty = s1Triwulans.reduce((sum, tw) => sum + (triwulans[tw]?.totalQty || 0), 0);
    const s1FarmerCount = s1Triwulans.reduce((sum, tw) => sum + (triwulans[tw]?.farmerCount || 0), 0);

    semesters['S1'] = {
      hasData: s1TriwulansWithData.length > 0,
      totalQty: Math.round(s1TotalQty * 100) / 100,
      farmerCount: s1FarmerCount,
      triwulansWithData: s1TriwulansWithData,
    };

    // Semester 2 = Q3 + Q4
    const s2Triwulans: Triwulan[] = ['Q3', 'Q4'];
    const s2TriwulansWithData = s2Triwulans.filter((tw) => triwulans[tw]?.hasData);
    const s2TotalQty = s2Triwulans.reduce((sum, tw) => sum + (triwulans[tw]?.totalQty || 0), 0);
    const s2FarmerCount = s2Triwulans.reduce((sum, tw) => sum + (triwulans[tw]?.farmerCount || 0), 0);

    semesters['S2'] = {
      hasData: s2TriwulansWithData.length > 0,
      totalQty: Math.round(s2TotalQty * 100) / 100,
      farmerCount: s2FarmerCount,
      triwulansWithData: s2TriwulansWithData,
    };

    return NextResponse.json({
      year,
      triwulans,
      semesters,
    });
  } catch (error) {
    console.error('[triwulan-status] Error fetching triwulan status:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil status triwulan' },
      { status: 500 }
    );
  }
}
