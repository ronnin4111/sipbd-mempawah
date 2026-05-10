import { create } from 'zustand';

export interface FilterState {
  years: string[];
  kecamatan: string[];
  desa: string[];
  fishType: string[];
  containerType: string[];
  businessType: string[];
  search: string;
  activeSection: string;
  isAdmin: boolean;
}

interface FilterActions {
  setYears: (years: string[]) => void;
  setKecamatan: (kecamatan: string[]) => void;
  setDesa: (desa: string[]) => void;
  setFishType: (fishType: string[]) => void;
  setContainerType: (containerType: string[]) => void;
  setBusinessType: (businessType: string[]) => void;
  setSearch: (search: string) => void;
  setActiveSection: (section: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  resetFilters: () => void;
}

const initialState: FilterState = {
  years: [],
  kecamatan: [],
  desa: [],
  fishType: [],
  containerType: [],
  businessType: [],
  search: '',
  activeSection: 'dashboard',
  isAdmin: false,
};

export const useFilterStore = create<FilterState & FilterActions>((set) => ({
  ...initialState,
  setYears: (years) => set({ years }),
  setKecamatan: (kecamatan) => set({ kecamatan }),
  setDesa: (desa) => set({ desa }),
  setFishType: (fishType) => set({ fishType }),
  setContainerType: (containerType) => set({ containerType }),
  setBusinessType: (businessType) => set({ businessType }),
  setSearch: (search) => set({ search }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  resetFilters: () => set(initialState),
}));
