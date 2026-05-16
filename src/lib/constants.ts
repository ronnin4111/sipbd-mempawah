export const KECAMATAN_DESA: Record<
  string,
  { desa: string; status: string }[]
> = {
  Anjongan: [
    { desa: "Anjungan Melancar", status: "Kelurahan" },
    { desa: "Anjungan Dalam", status: "Desa" },
    { desa: "Dema", status: "Desa" },
    { desa: "Kepayang", status: "Desa" },
    { desa: "Pak Bulu", status: "Desa" },
  ],
  Jongkat: [
    { desa: "Jungkat", status: "Desa" },
    { desa: "Peniti Luar", status: "Desa" },
    { desa: "Sungai Nipah", status: "Desa" },
    { desa: "Wajok Hilir", status: "Desa" },
    { desa: "Wajok Hulu", status: "Desa" },
  ],
  "Mempawah Hilir": [
    { desa: "Tanjung", status: "Kelurahan" },
    { desa: "Tengah", status: "Kelurahan" },
    { desa: "Terusan", status: "Kelurahan" },
    { desa: "Kuala Secapah", status: "Desa" },
    { desa: "Malikian", status: "Desa" },
    { desa: "Pasir", status: "Desa" },
    { desa: "Penibung", status: "Desa" },
    { desa: "Sengkubang", status: "Desa" },
  ],
  "Mempawah Timur": [
    { desa: "Pasir Wan Salim", status: "Kelurahan" },
    { desa: "Pulau Pedalaman", status: "Kelurahan" },
    { desa: "Antibar", status: "Desa" },
    { desa: "Parit Banjar", status: "Desa" },
    { desa: "Pasir Palembang", status: "Desa" },
    { desa: "Pasir Panjang", status: "Desa" },
    { desa: "Sejegi", status: "Desa" },
    { desa: "Sungai Bakau Kecil", status: "Desa" },
  ],
  Sadaniang: [
    { desa: "Amawang", status: "Desa" },
    { desa: "Ansiap", status: "Desa" },
    { desa: "Bum-bun", status: "Desa" },
    { desa: "Pentek", status: "Desa" },
    { desa: "Sekabuk", status: "Desa" },
    { desa: "Suak Barangan", status: "Desa" },
  ],
  Segedong: [
    { desa: "Parit Bugis", status: "Desa" },
    { desa: "Peniti Besar", status: "Desa" },
    { desa: "Peniti Dalam I", status: "Desa" },
    { desa: "Peniti Dalam II", status: "Desa" },
    { desa: "Sungai Burung", status: "Desa" },
    { desa: "Sungai Purun Besar", status: "Desa" },
  ],
  "Sungai Kunyit": [
    { desa: "Bukit Batu", status: "Desa" },
    { desa: "Mendalok", status: "Desa" },
    { desa: "Semparong Parit Raden", status: "Desa" },
    { desa: "Semudun", status: "Desa" },
    { desa: "Sungai Bundung Laut", status: "Desa" },
    { desa: "Sungai Dungun", status: "Desa" },
    { desa: "Sungai Duri I", status: "Desa" },
    { desa: "Sungai Duri II", status: "Desa" },
    { desa: "Sungai Kunyit Dalam", status: "Desa" },
    { desa: "Sungai Kunyit Hulu", status: "Desa" },
    { desa: "Sungai Kunyit Laut", status: "Desa" },
    { desa: "Sungai Limau", status: "Desa" },
  ],
  "Sungai Pinyuh": [
    { desa: "Sungai Pinyuh", status: "Kelurahan" },
    { desa: "Galang", status: "Desa" },
    { desa: "Nusapati", status: "Desa" },
    { desa: "Peniraman", status: "Desa" },
    { desa: "Sungai Bakau Besar Laut", status: "Desa" },
    { desa: "Sungai Batang", status: "Desa" },
    { desa: "Sungai Purun Kecil", status: "Desa" },
    { desa: "Sungai Rasau", status: "Desa" },
    { desa: "Sungai Bakau Besar Darat", status: "Desa" },
  ],
  Toho: [
    { desa: "Benuang", status: "Desa" },
    { desa: "Kecurit", status: "Desa" },
    { desa: "Pak Laheng", status: "Desa" },
    { desa: "Pak Utan", status: "Desa" },
    { desa: "Sambora", status: "Desa" },
    { desa: "Sepang", status: "Desa" },
    { desa: "Terap", status: "Desa" },
    { desa: "Toho Hilir", status: "Desa" },
  ],
};

export const KECAMATAN_LIST = Object.keys(KECAMATAN_DESA);

export const ALL_DESA = Object.entries(KECAMATAN_DESA).flatMap(([kec, desas]) =>
  desas.map((d) => ({ kecamatan: kec, desa: d.desa, status: d.status })),
);

export const FISH_TYPES = [
  "Mas",
  "Nila",
  "Lele",
  "Patin",
  "Jelawat",
  "Bawal Air Tawar",
  "Gurame",
  "Vaname",
  "Lainnya",
];

export const CONTAINER_TYPES = [
  "KJA",
  "Kolam Air Tenang",
  "Tambak",
  "Bioflok",
  "KJT",
  "Bak Semen",
  "Bak Terpal",
  "Kolam",
  "Kolam Terpal",
  "Keramba",
  "Sawah",
];

export const BUSINESS_TYPES = ["Pembesaran", "Pembenihan"];

export const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

// Approximate coordinates for each kecamatan center in Kab. Mempawah (from Wikipedia/OpenStreetMap)
export const KECAMATAN_COORDS: Record<string, { lat: number; lng: number }> = {
  Anjongan: { lat: 0.3561, lng: 109.1754 },
  Jongkat: { lat: 0.0718, lng: 109.1929 },
  "Mempawah Hilir": { lat: 0.3674, lng: 108.9514 },
  "Mempawah Timur": { lat: 0.3672, lng: 108.9778 },
  Sadaniang: { lat: 0.5277, lng: 109.1519 },
  Segedong: { lat: 0.1712, lng: 109.1833 },
  "Sungai Kunyit": { lat: 0.4998, lng: 108.9112 },
  "Sungai Pinyuh": { lat: 0.257, lng: 109.0915 },
  Toho: { lat: 0.4149, lng: 109.2225 },
};

// Approximate coordinates for each desa in Kab. Mempawah (from OpenStreetMap Nominatim)
// Key format: "kecamatan|desa" to avoid name collisions across kecamatan
export const DESA_COORDS: Record<string, { lat: number; lng: number }> = {
  // === Mempawah Hilir ===
  "Mempawah Hilir|Tanjung": { lat: 0.3350679, lng: 108.9225225 },
  "Mempawah Hilir|Tengah": { lat: 0.3551577, lng: 108.9528248 },
  "Mempawah Hilir|Terusan": { lat: 0.3685238, lng: 108.954857 },
  "Mempawah Hilir|Sengkubang": { lat: 0.4362985, lng: 109.0184538 },
  "Mempawah Hilir|Penibung": { lat: 0.4093555, lng: 108.9541312 },
  "Mempawah Hilir|Pasir": { lat: 0.3983, lng: 109.0228972 },
  "Mempawah Hilir|Kuala Secapah": { lat: 0.32627, lng: 108.9600539 },
  "Mempawah Hilir|Malikian": { lat: 0.4811539, lng: 109.0295869 },

  // === Toho ===
  "Toho|Toho Ilir": { lat: 0.4495852, lng: 109.1553266 },
  "Toho|Pak Laheng": { lat: 0.3842078, lng: 109.2433855 },
  "Toho|Kecurit": { lat: 0.3840147, lng: 109.1561959 },
  "Toho|Terap": { lat: 0.3796883, lng: 109.2064482 },
  "Toho|Sepang": { lat: 0.4571084, lng: 109.2503616 },
  "Toho|Pak Utan": { lat: 0.4046276, lng: 109.2958682 },
  "Toho|Benuang": { lat: 0.373786, lng: 109.2900588 },
  "Toho|Sambora": { lat: 0.3469655, lng: 109.2744519 },

  // === Sungai Pinyuh ===
  "Sungai Pinyuh|Sungai Pinyuh": { lat: 0.2716799, lng: 109.0732995 },
  "Sungai Pinyuh|Sungai Rasau": { lat: 0.3063136, lng: 109.0970638 },
  "Sungai Pinyuh|Sungai Bakau Besar Darat": {
    lat: 0.3281197,
    lng: 109.0575592,
  },
  "Sungai Pinyuh|Sungai Purun Kecil": { lat: 0.2392654, lng: 109.1635631 },
  "Sungai Pinyuh|Sungai Bakau Besar Laut": { lat: 0.2910035, lng: 109.0300342 },
  "Sungai Pinyuh|Sungai Batang": { lat: 0.2828653, lng: 109.0515112 },
  "Sungai Pinyuh|Peniraman": { lat: 0.2338335, lng: 109.1201941 },
  "Sungai Pinyuh|Nusapati": { lat: 0.2611532, lng: 109.0973216 },
  "Sungai Pinyuh|Galang": { lat: 0.3024278, lng: 109.1115429 },

  // === Siantan ===
  "Jongkat|Wajok Hilir": { lat: 0.1226973, lng: 109.2744658 },
  "Jongkat|Sungai Nipah": { lat: 0.0917707, lng: 109.1779802 },
  "Jongkat|Peniti Luar": { lat: 0.1222096, lng: 109.1618173 },
  "Jongkat|Wajok Hulu": { lat: 0.064768, lng: 109.3517677 },
  "Jongkat|Jungkat": { lat: 0.112891, lng: 109.2225083 },

  // === Sungai Kunyit ===
  "Sungai Kunyit|Sungai Duri I": { lat: 0.5535261, lng: 108.9293018 },
  "Sungai Kunyit|Sungai Duri II": { lat: 0.5374319, lng: 108.9384082 },
  "Sungai Kunyit|Bukit Batu": { lat: 0.5468343, lng: 108.9952184 },
  "Sungai Kunyit|Sungai Bundung Laut": { lat: 0.5195909, lng: 108.9179666 },
  "Sungai Kunyit|Sungai Kunyit Laut": { lat: 0.4999022, lng: 108.8531132 },
  "Sungai Kunyit|Sungai Kunyit Dalam": { lat: 0.4934595, lng: 108.9342925 },
  "Sungai Kunyit|Sungai Kunyit Hulu": { lat: 0.5266283, lng: 109.0427131 },
  "Sungai Kunyit|Sungai Limau": { lat: 0.4869215, lng: 108.9102536 },
  "Sungai Kunyit|Sungai Dungun": { lat: 0.473151, lng: 108.914545 },
  "Sungai Kunyit|Mendalok": { lat: 0.4629973, lng: 108.9349356 },
  "Sungai Kunyit|Semparong Parit Raden": { lat: 0.5125408, lng: 109.0496694 },
  "Sungai Kunyit|Semudun": { lat: 0.486891, lng: 109.0365551 },

  // === Segedong ===
  "Segedong|Peniti Besar": { lat: 0.2136608, lng: 109.2260677 },
  "Segedong|Sungai Purun Besar": { lat: 0.2051583, lng: 109.156473 },
  "Segedong|Parit Bugis": { lat: 0.1610372, lng: 109.1908175 },
  "Segedong|Peniti Dalam I": { lat: 0.1641752, lng: 109.311152 },
  "Segedong|Peniti Dalam II": { lat: 0.2170573, lng: 109.2619098 },
  "Segedong|Sungai Burung": { lat: 0.1595769, lng: 109.1660022 },

  // === Anjongan ===
  "Anjongan|Anjungan Melancar": { lat: 0.3339006, lng: 109.1468858 },
  "Anjongan|Anjungan Dalam": { lat: 0.3646276, lng: 109.1337613 },
  "Anjongan|Kepayang": { lat: 0.3164432, lng: 109.1819993 },
  "Anjongan|Pak Bulu": { lat: 0.3313688, lng: 109.2188413 },
  "Anjongan|Dema": { lat: 0.3563806, lng: 109.222069 },

  // === Sadaniang ===
  "Sadaniang|Sekabuk": { lat: 0.4848116, lng: 109.184237 },
  "Sadaniang|Pentek": { lat: 0.5315034, lng: 109.2226887 },
  "Sadaniang|Bum-bun": { lat: 0.5686013, lng: 109.0722414 },
  "Sadaniang|Amawang": { lat: 0.6064996, lng: 109.1216345 },
  "Sadaniang|Ansiap": { lat: 0.6116806, lng: 109.2535517 },
  "Sadaniang|Suak Barangan": { lat: 0.644893, lng: 109.1520129 },

  // === Mempawah Timur ===
  "Mempawah Timur|Pulau Pedalaman": { lat: 0.3706955, lng: 108.9623442 },
  "Mempawah Timur|Pasir Wan Salim": { lat: 0.3125949, lng: 108.980533 },
  "Mempawah Timur|Antibar": { lat: 0.3622155, lng: 108.9917907 },
  "Mempawah Timur|Sejegi": { lat: 0.4024172, lng: 109.0457811 },
  "Mempawah Timur|Pasir Palembang": { lat: 0.3460746, lng: 108.9711663 },
  "Mempawah Timur|Pasir Panjang": { lat: 0.3344164, lng: 108.9716923 },
  "Mempawah Timur|Sungai Bakau Kecil": { lat: 0.3100092, lng: 109.0046945 },
  "Mempawah Timur|Parit Banjar": { lat: 0.3049102, lng: 109.0205707 },
};

// Passwords are loaded from environment variables for security.
// Set ADMIN_PASSWORD and EXPORT_PASSWORD in your .env file.
export const IMPORT_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Separate password for Excel export (different from admin password)
export const EXPORT_PASSWORD = process.env.EXPORT_PASSWORD || '';

// Default commodity prices per fish type x container type (Pembesaran - Rp/Kg)
// Pembenihan prices are flat per fish type (Rp/Ekor)
export const DEFAULT_COMMODITY_PRICES: Record<
  string,
  Record<string, number>
> = {
  Mas: {
    KJA: 40000,
    "Kolam Air Tenang": 38000,
    Kolam: 38000,
    "Kolam Terpal": 38000,
    Tambak: 0,
    Bioflok: 38000,
    KJT: 38000,
    "Bak Semen": 38000,
    "Bak Terpal": 38000,
    Sawah: 38000,
  },
  Nila: {
    KJA: 32000,
    "Kolam Air Tenang": 30000,
    Kolam: 30000,
    "Kolam Terpal": 30000,
    Tambak: 30000,
    Bioflok: 30000,
    KJT: 30000,
    "Bak Semen": 30000,
    "Bak Terpal": 30000,
    Sawah: 30000,
  },
  Lele: {
    KJA: 27000,
    "Kolam Air Tenang": 25000,
    Kolam: 25000,
    "Kolam Terpal": 25000,
    Tambak: 0,
    Bioflok: 25000,
    KJT: 25000,
    "Bak Semen": 25000,
    "Bak Terpal": 25000,
    Sawah: 25000,
  },
  Patin: {
    KJA: 42000,
    "Kolam Air Tenang": 40000,
    Kolam: 40000,
    "Kolam Terpal": 40000,
    Tambak: 0,
    Bioflok: 40000,
    KJT: 40000,
    "Bak Semen": 40000,
    "Bak Terpal": 40000,
    Sawah: 40000,
  },
  Jelawat: {
    KJA: 52000,
    "Kolam Air Tenang": 50000,
    Kolam: 50000,
    "Kolam Terpal": 50000,
    Tambak: 0,
    Bioflok: 50000,
    KJT: 50000,
    "Bak Semen": 50000,
    "Bak Terpal": 50000,
    Sawah: 50000,
  },
  "Bawal Air Tawar": {
    KJA: 37000,
    "Kolam Air Tenang": 35000,
    Kolam: 35000,
    "Kolam Terpal": 35000,
    Tambak: 0,
    Bioflok: 35000,
    KJT: 35000,
    "Bak Semen": 35000,
    "Bak Terpal": 35000,
    Sawah: 35000,
  },
  Gurame: {
    KJA: 85000,
    "Kolam Air Tenang": 80000,
    Kolam: 80000,
    "Kolam Terpal": 80000,
    Tambak: 0,
    Bioflok: 80000,
    KJT: 80000,
    "Bak Semen": 80000,
    "Bak Terpal": 80000,
    Sawah: 80000,
  },
  Vaname: {
    KJA: 0,
    "Kolam Air Tenang": 0,
    Kolam: 0,
    "Kolam Terpal": 0,
    Tambak: 75000,
    Bioflok: 0,
    KJT: 0,
    "Bak Semen": 0,
    "Bak Terpal": 0,
    Sawah: 0,
  },
  Lainnya: {
    KJA: 30000,
    "Kolam Air Tenang": 28000,
    Kolam: 28000,
    "Kolam Terpal": 28000,
    Tambak: 28000,
    Bioflok: 28000,
    KJT: 28000,
    "Bak Semen": 28000,
    "Bak Terpal": 28000,
    Sawah: 28000,
  },
};

// ============================================================
// Navigation — single source of truth for Header tabs & Sidebar
// ============================================================
import {
  LayoutDashboard,
  Database,
  Map,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  ExternalLink,
  CreditCard,
  Lock,
  Share2,
  BarChart3,
  Briefcase,
  IdCard,
  FileCheck,
  Microscope,
  Fish,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;          // Short label (used in header tabs)
  labelLong: string;      // Longer label (used in sidebar)
  icon: LucideIcon;
  description: string;    // Shown under sidebar items
  adminOnly: boolean;
  headerHidden?: boolean; // true = shown in sidebar only (not in header tabs)
  group?: string;         // Group ID for dropdown grouping in header (undefined = standalone)
}

// ─── Navigation Groups (for header dropdown menus) ───────────────────────
export interface NavGroup {
  id: string;
  label: string;         // Label shown on the header tab
  icon: LucideIcon;      // Icon for the header tab
  color: string;         // Accent color for the group
  gradient: string;      // Gradient for active state
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'data',         label: 'Data',         icon: Database,       color: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
  { id: 'visualisasi',  label: 'Visualisasi',  icon: BarChart3,      color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  { id: 'informasi',    label: 'Informasi',    icon: Share2,         color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  { id: 'layanan',      label: 'Layanan',      icon: Briefcase,      color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
];

export const NAV_ITEMS: NavItem[] = [
  // Standalone — Dashboard (no group)
  { id: 'dashboard',         label: 'Dashboard',         labelLong: 'Ringkasan Produksi',  icon: LayoutDashboard, description: 'Ringkasan & statistik',           adminOnly: false },

  // Group: Data
  { id: 'data-produksi',     label: 'Data Pembudidaya',  labelLong: 'Data Pembudidaya',    icon: Database,        description: 'Tabel data lengkap',               adminOnly: false, group: 'data' },
  { id: 'data-kusuka',       label: 'Data KUSUKA',       labelLong: 'Data KUSUKA',          icon: CreditCard,      description: 'Registrasi KUSUKA publik',         adminOnly: false, group: 'data' },
  { id: 'import-export',     label: 'Import / Export',   labelLong: 'Import / Export',      icon: FileSpreadsheet, description: 'Kelola data Excel/PDF',             adminOnly: false, group: 'data' },

  // Group: Visualisasi
  { id: 'peta-lokasi',       label: 'Peta Lokasi',       labelLong: 'Peta Lokasi',          icon: Map,             description: 'Sebaran lokasi budidaya',           adminOnly: false, group: 'visualisasi' },
  { id: 'tren-laporan',      label: 'Tren & Laporan',    labelLong: 'Tren & Laporan',       icon: TrendingUp,      description: 'Analisis tren produksi',            adminOnly: false, group: 'visualisasi' },
  { id: 'tren-v2',           label: 'Tren V2',           labelLong: 'Tren V2 (Triwulan)',   icon: ExternalLink,    description: 'Data tren versi triwulan',          adminOnly: false, group: 'visualisasi' },

  // Group: Informasi
  { id: 'harga-komoditas',   label: 'Harga Komoditas',   labelLong: 'Harga Komoditas',      icon: DollarSign,      description: 'Daftar harga ikan',                 adminOnly: false, group: 'informasi' },
  { id: 'media-sosial',      label: 'Media Sosial',      labelLong: 'Media Sosial',         icon: Share2,          description: 'Akun & postingan resmi dinas',      adminOnly: false, group: 'informasi' },

  // Group: Layanan
  { id: 'layanan-ekusuka',   label: 'Kartu E-KUSUKA',    labelLong: 'Kartu E-KUSUKA',       icon: IdCard,          description: 'Kartu identitas pelaku KP',          adminOnly: false, group: 'layanan' },
  { id: 'layanan-nib',       label: 'NIB',               labelLong: 'Nomor Induk Berusaha',  icon: FileCheck,       description: 'Nomor Induk Berusaha via OSS',       adminOnly: false, group: 'layanan' },
  { id: 'layanan-cpib',      label: 'CPIB',              labelLong: 'CPIB',                  icon: Microscope,      description: 'Cara Pembenihan Ikan yang Baik',      adminOnly: false, group: 'layanan' },
  { id: 'layanan-cbib',      label: 'CBIB',              labelLong: 'CBIB',                  icon: Fish,            description: 'Cara Budidaya Ikan yang Baik',        adminOnly: false, group: 'layanan' },

  // Hidden — Admin Login (sidebar only)
  { id: 'admin-login',       label: 'Login Admin',       labelLong: 'Login Admin',          icon: Lock,            description: 'Akses fitur khusus admin',          adminOnly: false, headerHidden: true },
];

// Default Pembenihan prices (Rp/Ekor) - flat per fish type
export const DEFAULT_PEMBENIHAN_PRICES: Record<string, number> = {
  Mas: 350,
  Nila: 350,
  Lele: 350,
  Lainnya: 300,
};
