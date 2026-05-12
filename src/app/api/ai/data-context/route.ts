import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateFarmerId } from '@/lib/farmer-id';

/**
 * AI Data Context Endpoint
 * Provides detailed group and farmer data for the AI chatbot.
 * This is separate from /api/fish-farms/stats which provides aggregated statistics.
 *
 * Returns:
 * - groups: List of groups with details (name, kecamatan, desa, member count, fish types, business type)
 * - farmers: List of farmers with details (name, group, kecamatan, desa, fish type, KUSUKA status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

    // Build where clause from filters (same pattern as stats)
    const where: Record<string, unknown> = {};

    const yearParam = searchParams.get('year');
    if (yearParam) {
      const years = yearParam.split(',').map(Number).filter(n => !isNaN(n));
      if (years.length > 0) where.year = { in: years };
    } else {
      // Default to current year
      where.year = new Date().getFullYear();
    }

    const kecamatanParam = searchParams.get('kecamatan');
    if (kecamatanParam) {
      const list = kecamatanParam.split(',').filter(Boolean);
      if (list.length > 0) where.kecamatan = { in: list };
    }

    const desaParam = searchParams.get('desa');
    if (desaParam) {
      const list = desaParam.split(',').filter(Boolean);
      if (list.length > 0) where.desa = { in: list };
    }

    const fishTypeParam = searchParams.get('fishType');
    if (fishTypeParam) {
      const list = fishTypeParam.split(',').filter(Boolean);
      if (list.length > 0) where.fishType = { in: list };
    }

    const businessTypeParam = searchParams.get('businessType');
    if (businessTypeParam) {
      const list = businessTypeParam.split(',').filter(Boolean);
      if (list.length > 0) where.businessType = { in: list };
    }

    // Fetch records
    const records = await db.fishFarm.findMany({ where });

    // === Group Summary ===
    // Aggregate by group name + kecamatan + desa
    interface GroupInfo {
      name: string;
      kecamatan: string;
      desa: string;
      businessTypes: Set<string>;
      fishTypes: Set<string>;
      containerTypes: Set<string>;
      totalFarmerCount: number;
      totalRtpCount: number;
      totalProductionQty: number;
      totalProductionValue: number;
      kusukaCount: number;
      memberCount: number;
    }

    const groupMap = new Map<string, GroupInfo>();
    const groupFarmerIds = new Map<string, Set<string>>();

    records.forEach(r => {
      if (!r.groupName || !r.groupName.trim()) return;
      const normalizedName = r.groupName.trim();
      const key = `${normalizedName.toLowerCase()}|${r.kecamatan}|${r.desa}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: normalizedName,
          kecamatan: r.kecamatan,
          desa: r.desa,
          businessTypes: new Set(),
          fishTypes: new Set(),
          containerTypes: new Set(),
          totalFarmerCount: 0,
          totalRtpCount: 0,
          totalProductionQty: 0,
          totalProductionValue: 0,
          kusukaCount: 0,
          memberCount: 0,
        });
        groupFarmerIds.set(key, new Set());
      }

      const group = groupMap.get(key)!;
      group.businessTypes.add(r.businessType);
      group.fishTypes.add(r.fishType);
      group.containerTypes.add(r.containerType);
      group.totalProductionQty += r.productionQty;
      group.totalProductionValue += r.productionValue;

      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '',
        groupName: r.groupName || '',
        kecamatan: r.kecamatan || '',
        desa: r.desa || '',
      });
      groupFarmerIds.get(key)!.add(fid);
    });

    // Calculate accurate member counts using unique farmerIds
    const farmerLatestByGroup = new Map<string, Map<string, typeof records[0]>>();
    const sortedDesc = [...records].sort((a, b) => b.year - a.year);

    for (const r of sortedDesc) {
      if (!r.groupName || !r.groupName.trim()) continue;
      const key = `${r.groupName.trim().toLowerCase()}|${r.kecamatan}|${r.desa}`;
      if (!farmerLatestByGroup.has(key)) {
        farmerLatestByGroup.set(key, new Map());
      }
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '',
        groupName: r.groupName || '',
        kecamatan: r.kecamatan || '',
        desa: r.desa || '',
      });
      if (!farmerLatestByGroup.get(key)!.has(fid)) {
        farmerLatestByGroup.get(key)!.set(fid, r);
      }
    }

    // Calculate member/rtp/kusuka counts per group
    for (const [key, group] of groupMap) {
      const farmerMap = farmerLatestByGroup.get(key);
      if (farmerMap) {
        let memberCount = 0;
        let rtpCount = 0;
        let kusukaCount = 0;
        for (const r of farmerMap.values()) {
          memberCount += r.farmerCount;
          rtpCount += r.rtpCount;
          const k = String(r.kusuka || '').trim();
          if (/^\d{16}$/.test(k)) kusukaCount++;
        }
        group.memberCount = memberCount;
        group.totalRtpCount = rtpCount;
        group.totalFarmerCount = memberCount;
        group.kusukaCount = kusukaCount;
      }
    }

    // Convert to array and apply search filter
    let groups = Array.from(groupMap.values()).map(g => ({
      name: g.name,
      kecamatan: g.kecamatan,
      desa: g.desa,
      businessTypes: Array.from(g.businessTypes),
      fishTypes: Array.from(g.fishTypes),
      containerTypes: Array.from(g.containerTypes),
      memberCount: g.memberCount,
      rtpCount: g.totalRtpCount,
      productionQty: Math.round(g.totalProductionQty * 100) / 100,
      productionValue: Math.round(g.totalProductionValue * 100) / 100,
      kusukaCount: g.kusukaCount,
    }));

    if (search) {
      const q = search.toLowerCase();
      groups = groups.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.kecamatan.toLowerCase().includes(q) ||
        g.desa.toLowerCase().includes(q) ||
        g.fishTypes.some(f => f.toLowerCase().includes(q))
      );
    }

    // Sort by name and limit
    groups.sort((a, b) => a.name.localeCompare(b.name));
    const totalGroups = groups.length;
    groups = groups.slice(0, limit);

    // === Farmer Summary ===
    // Get unique farmers (by farmerId, latest record)
    const allFarmerLatest = new Map<string, typeof records[0]>();
    for (const r of sortedDesc) {
      const fid = r.farmerId || generateFarmerId({
        farmerName: r.farmerName || '',
        groupName: r.groupName || '',
        kecamatan: r.kecamatan || '',
        desa: r.desa || '',
      });
      if (!allFarmerLatest.has(fid)) {
        allFarmerLatest.set(fid, r);
      }
    }

    let farmers = Array.from(allFarmerLatest.values()).map(r => ({
      name: r.farmerName,
      groupName: r.groupName,
      kecamatan: r.kecamatan,
      desa: r.desa,
      fishType: r.fishType,
      businessType: r.businessType,
      containerType: r.containerType,
      kusuka: !!r.kusuka && /^\d{16}$/.test(String(r.kusuka || '').trim()),
      cpib: r.cpib,
      cbib: r.cbib,
    }));

    if (search) {
      const q = search.toLowerCase();
      farmers = farmers.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.groupName.toLowerCase().includes(q) ||
        f.kecamatan.toLowerCase().includes(q) ||
        f.desa.toLowerCase().includes(q) ||
        f.fishType.toLowerCase().includes(q)
      );
    }

    farmers.sort((a, b) => a.name.localeCompare(b.name));
    const totalFarmers = farmers.length;
    farmers = farmers.slice(0, limit);

    // === Kecamatan/Desa lists ===
    const kecamatanList = [...new Set(records.map(r => r.kecamatan))].sort();
    const desaByKecamatan: Record<string, string[]> = {};
    records.forEach(r => {
      if (!desaByKecamatan[r.kecamatan]) desaByKecamatan[r.kecamatan] = [];
      if (!desaByKecamatan[r.kecamatan].includes(r.desa)) {
        desaByKecamatan[r.kecamatan].push(r.desa);
      }
    });
    Object.values(desaByKecamatan).forEach(arr => arr.sort());

    return NextResponse.json({
      groups,
      totalGroups,
      farmers,
      totalFarmers,
      kecamatanList,
      desaByKecamatan,
      availableFishTypes: [...new Set(records.map(r => r.fishType))].sort(),
      availableBusinessTypes: [...new Set(records.map(r => r.businessType))].sort(),
      availableContainerTypes: [...new Set(records.map(r => r.containerType))].sort(),
      periodYear: where.year,
      limit,
    });
  } catch (error) {
    console.error('AI Data Context error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI data context' },
      { status: 500 }
    );
  }
}
