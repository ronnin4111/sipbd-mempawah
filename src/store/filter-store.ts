import { create } from 'zustand';

export interface FilterState {
  years: string[];
  kecamatan: string[];
  desa: string[];
  groupName: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
  search: string;
  activeSection: string;
  isAdmin: boolean;
  kecamatanChartSegment: string;
}

interface FilterActions {
  setYears: (years: string[]) => void;
  setKecamatan: (kecamatan: string[]) => void;
  setDesa: (desa: string[]) => void;
  setGroupName: (groupName: string[]) => void;
  setFishType: (fishType: string[]) => void;
  setContainerType: (containerType: string[]) => void;
  setBusinessType: (businessType: string[]) => void;
  setSearch: (search: string) => void;
  setActiveSection: (section: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setKecamatanChartSegment: (segment: string) => void;
  resetFilters: () => void;
}

const initialState: FilterState = {
  years: [],
  kecamatan: [],
  desa: [],
  groupName: [],
  fishType: [],
  containerType: [],
  businessType: [],
  search: '',
  activeSection: 'disagregasi-analisis',
  isAdmin: false,
  kecamatanChartSegment: 'produksi',
};

export const useFilterStore = create<FilterState & FilterActions>((set) => ({
  ...initialState,
  setYears: (years) => set({ years }),
  setKecamatan: (kecamatan) => set({ kecamatan }),
  setDesa: (desa) => set({ desa }),
  setGroupName: (groupName) => set({ groupName }),
  setFishType: (fishType) => set({ fishType }),
  setContainerType: (containerType) => set({ containerType }),
  setBusinessType: (businessType) => set({ businessType }),
  setSearch: (search) => set({ search }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setKecamatanChartSegment: (kecamatanChartSegment) => set({ kecamatanChartSegment }),
  resetFilters: () => set(initialState),
}));
