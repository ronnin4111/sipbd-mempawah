'use client';

import { useQuery } from '@tanstack/react-query';
import { useFilterStore } from '@/store/filter-store';

function buildFilterParams(
  years: string[],
  kecamatan: string[],
  desa: string[],
  fishType: string[],
  containerType: string[],
  businessType: string[],
  search: string
): URLSearchParams {
  const params = new URLSearchParams();
  
  if (years.length > 0) params.set('year', years.join(','));
  if (kecamatan.length > 0) params.set('kecamatan', kecamatan.join(','));
  if (desa.length > 0) params.set('desa', desa.join(','));
  if (fishType.length > 0) params.set('fishType', fishType.join(','));
  if (containerType.length > 0) params.set('containerType', containerType.join(','));
  if (businessType.length > 0) params.set('businessType', businessType.join(','));
  if (search) params.set('search', search);
  
  return params;
}

export interface FishFarm {
  id: string;
  year: number;
  kecamatan: string;
  desa: string;
  fishType: string;
  containerType: string;
  businessType: string;
  productionQty: number;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  targetQty: number;
  productionValue: number;
  latitude: number;
  longitude: number;
}

export interface FishFarmResponse {
  data: FishFarm[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatsResponse {
  totalProduction: number;
  totalRtp: number;
  totalFarmer: number;
  totalGroup: number;
  pembesaranProduction: number;
  pembenihanProduction: number;
  productionByFishType: Record<string, number>;
  productionByContainer: Record<string, number>;
  productionByKecamatan: Record<string, number>;
  productionByYear: Record<string, number>;
  rtpByBusinessType: Record<string, number>;
  farmerByBusinessType: Record<string, number>;
  groupByBusinessType: Record<string, number>;
  targetVsRealisasi: Record<string, { target: number; realisasi: number }>;
  trend5Year: Record<string, { pembesaran: number; pembenihan: number }>;
  productionByKecamatanDetail: Record<string, { production: number; value: number; rtp: number; farmer: number; group: number }>;
}

export function useFishFarms(page: number = 1, pageSize: number = 20) {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<FishFarmResponse>({
    queryKey: ['fish-farms', page, pageSize, years, kecamatan, desa, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, fishType, containerType, businessType, search);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      const res = await fetch(`/api/fish-farms?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch fish farms');
      return res.json();
    },
  });
}

export function useFishFarmStats() {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<StatsResponse>({
    queryKey: ['fish-farms-stats', years, kecamatan, desa, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, fishType, containerType, businessType, search);
      const res = await fetch(`/api/fish-farms/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });
}

export function useAllFishFarms() {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<FishFarmResponse>({
    queryKey: ['fish-farms-all', years, kecamatan, desa, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, fishType, containerType, businessType, search);
      params.set('pageSize', '1000');
      const res = await fetch(`/api/fish-farms?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch fish farms');
      return res.json();
    },
  });
}
