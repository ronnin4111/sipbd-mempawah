'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFilterStore } from '@/store/filter-store';

function buildFilterParams(
  years: string[],
  kecamatan: string[],
  desa: string[],
  groupName: string[],
  fishType: string[],
  containerType: string[],
  businessType: string[],
  search: string
): URLSearchParams {
  const params = new URLSearchParams();
  
  if (years.length > 0) params.set('year', years.join(','));
  if (kecamatan.length > 0) params.set('kecamatan', kecamatan.join(','));
  if (desa.length > 0) params.set('desa', desa.join(','));
  if (groupName.length > 0) params.set('groupName', groupName.join(','));
  if (fishType.length > 0) params.set('fishType', fishType.join(','));
  if (containerType.length > 0) params.set('containerType', containerType.join(','));
  if (businessType.length > 0) params.set('businessType', businessType.join(','));
  if (search) params.set('search', search);
  
  return params;
}

export interface FishFarm {
  id: string;
  farmerId: string;
  year: number;
  triwulan: string;
  kecamatan: string;
  desa: string;
  fishType: string;
  containerType: string;
  businessType: string;
  farmerName: string;
  groupName: string;
  productionQty: number;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  targetQty: number;
  productionValue: number;
  latitude: number;
  longitude: number;
  kusuka: string;
  cpib: boolean;
  cbib: boolean;
  disaggregationBatchId: string | null;
}

export interface FishFarmResponse {
  data: FishFarm[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatsResponse {
  pembesaranProduction: number;
  pembenihanProduction: number;
  totalRtp: number;
  totalFarmer: number;
  totalGroup: number;
  latestYear: number | null;
  rtpByBusinessType: Record<string, number>;
  farmerByBusinessType: Record<string, number>;
  groupByBusinessType: Record<string, number>;
  // Display period data for dashboard cards
  currentYear: number;
  periodLabel: string;
  currentYearPembesaranProduction: number;
  currentYearPembenihanProduction: number;
  currentYearProductionByFishType: Record<string, { pembesaran: number; pembenihan: number }>;
  currentYearGroupByBusinessType: Record<string, number>;
  currentYearFarmerByBusinessType: Record<string, number>;
  currentYearRtpByBusinessType: Record<string, number>;
  productionByFishType: Record<string, { pembesaran: number; pembenihan: number }>;
  productionByContainer: Record<string, { pembesaran: number; pembenihan: number }>;
  productionByKecamatan: Record<string, { pembesaran: number; pembenihan: number }>;
  productionByYear: Record<string, { pembesaran: number; pembenihan: number }>;
  targetVsRealisasiPembesaran: Record<string, { target: number; realisasi: number }>;
  targetVsRealisasiPembenihan: Record<string, { target: number; realisasi: number }>;
  trend5Year: Record<string, { pembesaran: number; pembenihan: number }>;
  productionByKecamatanDetail: Record<string, {
    pembesaranProduction: number;
    pembenihanProduction: number;
    value: number;
    rtp: number;
    farmer: number;
    group: number;
    pembesaranFarmer: number;
    pembenihanFarmer: number;
    pembesaranRtp: number;
    pembenihanRtp: number;
    pembesaranGroup: number;
    pembenihanGroup: number;
  }>;
  productionByFishTypeDetail: Record<string, {
    pembesaranProduction: number;
    pembenihanProduction: number;
    value: number;
    rtp: number;
    farmer: number;
    group: number;
  }>;
  trendByFishType: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
  trendByKecamatan: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
  trendByContainer: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
  productionByKecamatanByFishType: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
  productionByKecamatanByContainer: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
  totalKusuka: number;
}

export function useFishFarms(page: number = 1, pageSize: number = 20) {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const groupName = useFilterStore((s) => s.groupName);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<FishFarmResponse>({
    queryKey: ['fish-farms', page, pageSize, years, kecamatan, desa, groupName, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, groupName, fishType, containerType, businessType, search);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      const res = await fetch(`/api/fish-farms?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch fish farms');
      return res.json();
    },
  });
}

export function useFishFarmStats(enabled: boolean = true) {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const groupName = useFilterStore((s) => s.groupName);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<StatsResponse>({
    queryKey: ['fish-farms-stats', years, kecamatan, desa, groupName, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, groupName, fishType, containerType, businessType, search);
      const res = await fetch(`/api/fish-farms/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled,
  });
}

export function useAvailableYears() {
  return useQuery<{ years: number[] }>({
    queryKey: ['fish-farms-years'],
    queryFn: async () => {
      const res = await fetch('/api/fish-farms/years');
      if (!res.ok) throw new Error('Failed to fetch years');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useGroupNames() {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);

  return useQuery<{ groupNames: string[] }>({
    queryKey: ['fish-farms-group-names', years, kecamatan, desa, fishType, containerType, businessType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (years.length > 0) params.set('year', years.join(','));
      if (kecamatan.length > 0) params.set('kecamatan', kecamatan.join(','));
      if (desa.length > 0) params.set('desa', desa.join(','));
      if (fishType.length > 0) params.set('fishType', fishType.join(','));
      if (containerType.length > 0) params.set('containerType', containerType.join(','));
      if (businessType.length > 0) params.set('businessType', businessType.join(','));
      const res = await fetch(`/api/fish-farms/group-names?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch group names');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface FilterOptionsResponse {
  years: number[];
  kecamatan: string[];
  desa: string[];
  groupNames: string[];
  fishTypes: string[];
  containerTypes: string[];
  businessTypes: string[];
}

export function useFilterOptions() {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const groupName = useFilterStore((s) => s.groupName);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);

  return useQuery<FilterOptionsResponse>({
    queryKey: [
      'fish-farms-filter-options',
      years,
      kecamatan,
      desa,
      groupName,
      fishType,
      containerType,
      businessType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (years.length > 0) params.set('year', years.join(','));
      if (kecamatan.length > 0) params.set('kecamatan', kecamatan.join(','));
      if (desa.length > 0) params.set('desa', desa.join(','));
      if (groupName.length > 0) params.set('groupName', groupName.join(','));
      if (fishType.length > 0) params.set('fishType', fishType.join(','));
      if (containerType.length > 0)
        params.set('containerType', containerType.join(','));
      if (businessType.length > 0)
        params.set('businessType', businessType.join(','));
      const res = await fetch(
        `/api/fish-farms/filter-options?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch filter options');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllFishFarms() {
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const groupName = useFilterStore((s) => s.groupName);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  return useQuery<FishFarmResponse>({
    queryKey: ['fish-farms-all', years, kecamatan, desa, groupName, fishType, containerType, businessType, search],
    queryFn: async () => {
      const params = buildFilterParams(years, kecamatan, desa, groupName, fishType, containerType, businessType, search);
      params.set('pageSize', '1000');
      const res = await fetch(`/api/fish-farms?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch fish farms');
      return res.json();
    },
  });
}

// === CRUD Mutations ===

export function useCreateFishFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ password, data }: { password: string; data: Partial<FishFarm> }) => {
      const res = await fetch('/api/fish-farms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambah data');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fish-farms'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-all'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-years'] });
    },
  });
}

export function useUpdateFishFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ password, id, data }: { password: string; id: string; data: Partial<FishFarm> }) => {
      const res = await fetch(`/api/fish-farms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengubah data');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fish-farms'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-all'] });
    },
  });
}

export function useDeleteFishFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ password, id }: { password: string; id: string }) => {
      const res = await fetch(`/api/fish-farms/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus data');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fish-farms'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-all'] });
      queryClient.invalidateQueries({ queryKey: ['fish-farms-years'] });
    },
  });
}
