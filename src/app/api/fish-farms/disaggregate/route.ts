import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IMPORT_PASSWORD } from '@/lib/constants';
import { generateFarmerId } from '@/lib/farmer-id';

// Valid triwulan values
const VALID_TRIWULAN = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * GET /api/fish-farms/disaggregate?action=preview
 * Preview proportional distribution of aggregate production data to individual farmers.
 *
 * Query params:
 *   year          - target year (e.g. 2025)
 *   triwulan      - Q1/Q2/Q3/Q4
 *   kecamatan     - kecamatan name
 *   fishType      - fish type name
 *   containerType - container type name
 *   businessType  - Pembesaran / Pembenihan
 *   totalQty      - the aggregate total to distribute
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const year = Number(searchParams.get('year'));
    const triwulan = searchParams.get('triwulan') || 'Q4';
    const kecamatan = searchParams.get('kecamatan') || '';
    const fishType = searchParams.get('fishType') || '';
    const containerType = searchParams.get('containerType') || '';
    const businessType = searchParams.get('businessType') || '';
    const totalQty = Number(searchParams.get('totalQty'));

    // Validate required params
    if (!year || !kecamatan || !fishType || !containerType || !businessType || !totalQty) {
      return NextResponse.json(
        { error: 'Parameter tidak lengkap (year, triwulan, kecamatan, fishType, containerType, businessType, totalQty)' },
        { status: 400 }
      );
    }

    if (!VALID_TRIWULAN.includes(triwulan)) {
      return NextResponse.json(
        { error: 'Triwulan tidak valid. Gunakan Q1, Q2, Q3, atau Q4' },
        { status: 400 }
      );
    }

    // Step 1: Find all existing FishFarm records matching: kecamatan + fishType + containerType + businessType
    // Look in the current year first, then most recent year
    const matchCriteria = {
      kecamatan,
      fishType,
      containerType,
      businessType,
    };

    // Find records in the target year
    let existingRecords = await db.fishFarm.findMany({
      where: {
        ...matchCriteria,
        year,
      },
      orderBy: { productionQty: 'desc' },
    });

    // If no records found in target year, find most recent year with matching records
    let referenceYear = year;
    if (existingRecords.length === 0) {
      const mostRecent = await db.fishFarm.findFirst({
        where: matchCriteria,
        orderBy: { year: 'desc' },
        select: { year: true },
      });
      if (mostRecent) {
        referenceYear = mostRecent.year;
        existingRecords = await db.fishFarm.findMany({
          where: {
            ...matchCriteria,
            year: referenceYear,
          },
          orderBy: { productionQty: 'desc' },
        });
      }
    }

    if (existingRecords.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data petani yang cocok untuk kriteria ini' },
        { status: 404 }
      );
    }

    // Step 2: Check if same triwulan exists in previous data for proportional distribution
    // Look for records with the same triwulan in the most recent year
    let hasReference = false;

    // Try to find reference data: same criteria + triwulan in the reference year
    const referenceRecords = await db.fishFarm.findMany({
      where: {
        ...matchCriteria,
        year: referenceYear,
        triwulan,
      },
    });

    if (referenceRecords.length > 0) {
      hasReference = true;
    }

    // Use reference data if available, otherwise use all matching records from that year
    const recordsForDistribution = hasReference ? referenceRecords : existingRecords;

    // Step 3: Calculate proportional distribution
    const totalReference = recordsForDistribution.reduce((sum, r) => sum + r.productionQty, 0);

    // Group by farmerId and sum up their production for proportional calculation
    const farmerMap = new Map<string, {
      farmerId: string;
      farmerName: string;
      groupName: string;
      desa: string;
      referenceQty: number;
      rtpCount: number;
      farmerCount: number;
      groupCount: number;
      latitude: number;
      longitude: number;
      kusuka: string;
      cpib: boolean;
      cbib: boolean;
    }>();

    for (const r of recordsForDistribution) {
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName,
        groupName: r.groupName,
        kecamatan: r.kecamatan,
        desa: r.desa,
      });

      const existing = farmerMap.get(fid);
      if (existing) {
        existing.referenceQty += r.productionQty;
      } else {
        farmerMap.set(fid, {
          farmerId: fid,
          farmerName: r.farmerName,
          groupName: r.groupName,
          desa: r.desa,
          referenceQty: r.productionQty,
          rtpCount: r.rtpCount,
          farmerCount: r.farmerCount,
          groupCount: r.groupCount,
          latitude: r.latitude,
          longitude: r.longitude,
          kusuka: r.kusuka,
          cpib: r.cpib,
          cbib: r.cbib,
        });
      }
    }

    const farmers = Array.from(farmerMap.values());

    // Distribute proportionally
    const farmersWithAllocation = farmers.map((f) => {
      const proportion = totalReference > 0 ? f.referenceQty / totalReference : 1 / farmers.length;
      const allocatedQty = Math.round(proportion * totalQty * 100) / 100;
      const adjustmentPct = totalReference > 0
        ? Math.round(((totalQty / totalReference) - 1) * 10000) / 100
        : 0;

      return {
        farmerId: f.farmerId,
        farmerName: f.farmerName,
        groupName: f.groupName,
        desa: f.desa,
        referenceQty: Math.round(f.referenceQty * 100) / 100,
        proportion: Math.round(proportion * 10000) / 10000,
        allocatedQty,
        adjustmentPct,
        // Include metadata for save operation
        rtpCount: f.rtpCount,
        farmerCount: f.farmerCount,
        groupCount: f.groupCount,
        latitude: f.latitude,
        longitude: f.longitude,
        kusuka: f.kusuka,
        cpib: f.cpib,
        cbib: f.cbib,
        isNew: false,
      };
    });

    // Adjust for rounding: ensure total matches totalQty
    const totalAllocated = farmersWithAllocation.reduce((sum, f) => sum + f.allocatedQty, 0);
    const diff = Math.round((totalQty - totalAllocated) * 100) / 100;
    if (diff !== 0 && farmersWithAllocation.length > 0) {
      // Add the difference to the largest farmer
      farmersWithAllocation[0].allocatedQty = Math.round((farmersWithAllocation[0].allocatedQty + diff) * 100) / 100;
    }

    const finalTotal = farmersWithAllocation.reduce((sum, f) => sum + f.allocatedQty, 0);

    return NextResponse.json({
      farmers: farmersWithAllocation,
      totalAllocated: Math.round(finalTotal * 100) / 100,
      totalReference: Math.round(totalReference * 100) / 100,
      hasReference,
      referenceYear,
    });
  } catch (error) {
    console.error('Error previewing disaggregation:', error);
    return NextResponse.json(
      { error: 'Gagal mempreview disagregasi' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fish-farms/disaggregate
 * Save disaggregated data as individual FishFarm records.
 *
 * Body:
 *   password     - "diskan2026"
 *   year         - target year
 *   triwulan     - Q1/Q2/Q3/Q4
 *   kecamatan    - kecamatan name
 *   fishType     - fish type
 *   containerType - container type
 *   businessType - Pembesaran/Pembenihan
 *   totalQty     - total aggregate quantity
 *   notes        - optional notes
 *   farmers[]    - array of farmer allocations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      password,
      year,
      triwulan,
      kecamatan,
      fishType,
      containerType,
      businessType,
      totalQty,
      notes = '',
      farmers,
    } = body as {
      password: string;
      year: number;
      triwulan: string;
      kecamatan: string;
      fishType: string;
      containerType: string;
      businessType: string;
      totalQty: number;
      notes?: string;
      farmers: {
        farmerId?: string;
        farmerName: string;
        groupName: string;
        desa: string;
        allocatedQty: number;
        rtpCount?: number;
        farmerCount?: number;
        groupCount?: number;
        latitude?: number;
        longitude?: number;
        kusuka?: string;
        cpib?: boolean;
        cbib?: boolean;
        isNew: boolean;
      }[];
    };

    // Verify password
    if (password !== IMPORT_PASSWORD) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!year || !triwulan || !kecamatan || !fishType || !containerType || !businessType || !totalQty) {
      return NextResponse.json(
        { error: 'Field wajib tidak lengkap' },
        { status: 400 }
      );
    }

    if (!VALID_TRIWULAN.includes(triwulan)) {
      return NextResponse.json(
        { error: 'Triwulan tidak valid. Gunakan Q1, Q2, Q3, atau Q4' },
        { status: 400 }
      );
    }

    if (!Array.isArray(farmers) || farmers.length === 0) {
      return NextResponse.json(
        { error: 'Data petani tidak boleh kosong' },
        { status: 400 }
      );
    }

    // Step 1: Create DisaggregationBatch
    const batch = await db.disaggregationBatch.create({
      data: {
        year,
        triwulan,
        kecamatan,
        fishType,
        containerType,
        businessType,
        totalQty,
        notes,
      },
    });

    // Step 2: Create FishFarm records for each farmer
    const createdRecords = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < farmers.length; i += BATCH_SIZE) {
      const farmerBatch = farmers.slice(i, i + BATCH_SIZE);
      const createPromises = farmerBatch.map(async (farmer) => {
        let farmerId = farmer.farmerId || '';

        if (farmer.isNew || !farmerId) {
          // Generate new farmerId for new farmers
          farmerId = generateFarmerId({
            farmerName: farmer.farmerName,
            groupName: farmer.groupName,
            kecamatan,
            desa: farmer.desa,
          });
        }

        // For existing farmers, look up their latest record to get metadata
        let metadata = {
          rtpCount: farmer.rtpCount || 1,
          farmerCount: farmer.farmerCount || 1,
          groupCount: farmer.groupCount || 0,
          latitude: farmer.latitude || 0,
          longitude: farmer.longitude || 0,
          kusuka: farmer.kusuka || '',
          cpib: farmer.cpib || false,
          cbib: farmer.cbib || false,
        };

        if (!farmer.isNew && farmerId) {
          const existingRecord = await db.fishFarm.findFirst({
            where: { farmerId },
            orderBy: { year: 'desc' },
          });
          if (existingRecord) {
            metadata = {
              rtpCount: farmer.rtpCount ?? existingRecord.rtpCount,
              farmerCount: farmer.farmerCount ?? existingRecord.farmerCount,
              groupCount: farmer.groupCount ?? existingRecord.groupCount,
              latitude: farmer.latitude ?? existingRecord.latitude,
              longitude: farmer.longitude ?? existingRecord.longitude,
              kusuka: farmer.kusuka ?? existingRecord.kusuka,
              cpib: farmer.cpib ?? existingRecord.cpib,
              cbib: farmer.cbib ?? existingRecord.cbib,
            };
          }
        }

        return db.fishFarm.create({
          data: {
            year,
            triwulan,
            farmerId,
            kecamatan,
            desa: farmer.desa,
            fishType,
            containerType,
            businessType,
            farmerName: farmer.farmerName,
            groupName: farmer.groupName,
            productionQty: farmer.allocatedQty,
            rtpCount: metadata.rtpCount,
            farmerCount: metadata.farmerCount,
            groupCount: metadata.groupCount,
            targetQty: 0,
            productionValue: 0,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            kusuka: metadata.kusuka,
            cpib: metadata.cpib,
            cbib: metadata.cbib,
            disaggregationBatchId: batch.id,
          },
        });
      });

      const results = await Promise.all(createPromises);
      createdRecords.push(...results);
    }

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      createdCount: createdRecords.length,
      totalQty: Math.round(createdRecords.reduce((sum, r) => sum + r.productionQty, 0) * 100) / 100,
    });
  } catch (error) {
    console.error('Error saving disaggregation:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan data disagregasi' },
      { status: 500 }
    );
  }
}
