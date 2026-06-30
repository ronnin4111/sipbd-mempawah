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
  // Shared state for Analisis S1 page (used by AnalyzeDashboard + SmartNarrator)
  analyzeYear: number;
  analyzeSemester: number | null; // null = all, 1 = S1, 2 = S2
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
  setAnalyzeYear: (year: number) => void;
  setAnalyzeSemester: (semester: number | null) => void;
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
  analyzeYear: new Date().getFullYear(),
  analyzeSemester: null,
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
  setAnalyzeYear: (analyzeYear) => set({ analyzeYear }),
  setAnalyzeSemester: (analyzeSemester) => set({ analyzeSemester }),
  // Reset only the data filters — preserve activeSection, isAdmin, and
  // kecamatanChartSegment so admins don't get logged out / bounced to dashboard.
  resetFilters: () =>
    set({
      years: [],
      kecamatan: [],
      desa: [],
      groupName: [],
      fishType: [],
      containerType: [],
      businessType: [],
      search: '',
    }),
}));
