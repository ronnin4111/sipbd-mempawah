export const KECAMATAN_DESA: Record<string, { desa: string; status: string }[]> = {
  "Anjongan": [
    { desa: "Anjungan Melancar", status: "Kelurahan" },
    { desa: "Anjungan Dalam", status: "Desa" },
    { desa: "Dema", status: "Desa" },
    { desa: "Kepayang", status: "Desa" },
    { desa: "Pak Bulu", status: "Desa" },
  ],
  "Jongkat": [
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
  "Sadaniang": [
    { desa: "Amawang", status: "Desa" },
    { desa: "Ansiap", status: "Desa" },
    { desa: "Bum-bun", status: "Desa" },
    { desa: "Pentek", status: "Desa" },
    { desa: "Sekabuk", status: "Desa" },
    { desa: "Suak Barangan", status: "Desa" },
  ],
  "Segedong": [
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
    { desa: "Sungai Rasau Besar Darat", status: "Desa" },
  ],
  "Toho": [
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
  desas.map(d => ({ kecamatan: kec, desa: d.desa, status: d.status }))
);

export const FISH_TYPES = ["Mas", "Nila", "Lele", "Patin", "Jelawat", "Bawal Air Tawar", "Gurame", "Vaname", "Lainnya"];

export const CONTAINER_TYPES = ["KJA", "Kolam Air Tenang", "Tambak", "Bioflok", "KJT", "Bak Semen", "Bak Terpal", "Kolam", "Kolam Terpal", "Keramba", "Sawah"];

export const BUSINESS_TYPES = ["Pembesaran", "Pembenihan"];

export const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

// Approximate coordinates for each kecamatan center in Kab. Mempawah (from Wikipedia/OpenStreetMap)
export const KECAMATAN_COORDS: Record<string, { lat: number; lng: number }> = {
  "Anjongan": { lat: 0.3561, lng: 109.1754 },
  "Jongkat": { lat: 0.0718, lng: 109.1929 },
  "Mempawah Hilir": { lat: 0.3674, lng: 108.9514 },
  "Mempawah Timur": { lat: 0.3672, lng: 108.9778 },
  "Sadaniang": { lat: 0.5277, lng: 109.1519 },
  "Segedong": { lat: 0.1712, lng: 109.1833 },
  "Sungai Kunyit": { lat: 0.4998, lng: 108.9112 },
  "Sungai Pinyuh": { lat: 0.2570, lng: 109.0915 },
  "Toho": { lat: 0.4149, lng: 109.2225 },
};

// Approximate coordinates for each desa in Kab. Mempawah (from OpenStreetMap Nominatim)
// Key format: "kecamatan|desa" to avoid name collisions across kecamatan
export const DESA_COORDS: Record<string, { lat: number; lng: number }> = {
  // Anjongan
  "Anjongan|Anjungan Melancar": { lat: 0.3606, lng: 109.1653 },
  "Anjongan|Anjungan Dalam": { lat: 0.3500, lng: 109.1559 },
  "Anjongan|Dema": { lat: 0.3360, lng: 109.2179 },
  "Anjongan|Kepayang": { lat: 0.3376, lng: 109.1870 },
  "Anjongan|Pak Bulu": { lat: 0.3384, lng: 109.2134 },
  // Jongkat
  "Jongkat|Jungkat": { lat: 0.0718, lng: 109.1929 },
  "Jongkat|Peniti Luar": { lat: 0.1258, lng: 109.1557 },
  "Jongkat|Sungai Nipah": { lat: 0.0948, lng: 109.1723 },
  "Jongkat|Wajok Hilir": { lat: 0.0567, lng: 109.2142 },
  "Jongkat|Wajok Hulu": { lat: 0.0267, lng: 109.2579 },
  // Mempawah Hilir
  "Mempawah Hilir|Tanjung": { lat: 0.3361, lng: 108.9348 },
  "Mempawah Hilir|Tengah": { lat: 0.3485, lng: 108.9630 },
  "Mempawah Hilir|Terusan": { lat: 0.3671, lng: 108.9510 },
  "Mempawah Hilir|Kuala Secapah": { lat: 0.3278, lng: 108.9665 },
  "Mempawah Hilir|Malikian": { lat: 0.4480, lng: 108.9424 },
  "Mempawah Hilir|Pasir": { lat: 0.4046, lng: 108.9473 },
  "Mempawah Hilir|Penibung": { lat: 0.4185, lng: 108.9469 },
  "Mempawah Hilir|Sengkubang": { lat: 0.4362, lng: 108.9453 },
  // Mempawah Timur
  "Mempawah Timur|Pasir Wan Salim": { lat: 0.3228, lng: 108.9706 },
  "Mempawah Timur|Pulau Pedalaman": { lat: 0.3706, lng: 108.9615 },
  "Mempawah Timur|Antibar": { lat: 0.3598, lng: 108.9691 },
  "Mempawah Timur|Parit Banjar": { lat: 0.3045, lng: 109.0188 },
  "Mempawah Timur|Pasir Palembang": { lat: 0.3452, lng: 108.9742 },
  "Mempawah Timur|Pasir Panjang": { lat: 0.3309, lng: 108.9751 },
  "Mempawah Timur|Sejegi": { lat: 0.3735, lng: 108.9678 },
  "Mempawah Timur|Sungai Bakau Kecil": { lat: 0.3115, lng: 109.0097 },
  // Sadaniang
  "Sadaniang|Amawang": { lat: 0.5545, lng: 109.1396 },
  "Sadaniang|Ansiap": { lat: 0.5797, lng: 109.2350 },
  "Sadaniang|Bum-bun": { lat: 0.5457, lng: 109.1019 },
  "Sadaniang|Pentek": { lat: 0.5163, lng: 109.1548 },
  "Sadaniang|Sekabuk": { lat: 0.5000, lng: 109.1293 },
  "Sadaniang|Suak Barangan": { lat: 0.6585, lng: 109.2011 },
  // Segedong
  "Segedong|Parit Bugis": { lat: 0.1543, lng: 109.1916 },
  "Segedong|Peniti Besar": { lat: 0.1595, lng: 109.2006 },
  "Segedong|Peniti Dalam I": { lat: 0.1558, lng: 109.1974 },
  "Segedong|Peniti Dalam II": { lat: 0.1712, lng: 109.2159 },
  "Segedong|Sungai Burung": { lat: 0.1574, lng: 109.1598 },
  "Segedong|Sungai Purun Besar": { lat: 0.1993, lng: 109.1502 },
  // Sungai Kunyit
  "Sungai Kunyit|Bukit Batu": { lat: 0.5232, lng: 108.9477 },
  "Sungai Kunyit|Mendalok": { lat: 0.4621, lng: 108.9331 },
  "Sungai Kunyit|Semparong Parit Raden": { lat: 0.4621, lng: 108.9694 },
  "Sungai Kunyit|Semudun": { lat: 0.4530, lng: 108.9379 },
  "Sungai Kunyit|Sungai Bundung Laut": { lat: 0.5161, lng: 108.9239 },
  "Sungai Kunyit|Sungai Dungun": { lat: 0.4707, lng: 108.9276 },
  "Sungai Kunyit|Sungai Duri I": { lat: 0.5381, lng: 108.9497 },
  "Sungai Kunyit|Sungai Duri II": { lat: 0.5518, lng: 108.9239 },
  "Sungai Kunyit|Sungai Kunyit Dalam": { lat: 0.4953, lng: 108.9350 },
  "Sungai Kunyit|Sungai Kunyit Hulu": { lat: 0.4914, lng: 108.9581 },
  "Sungai Kunyit|Sungai Kunyit Laut": { lat: 0.4962, lng: 108.9111 },
  "Sungai Kunyit|Sungai Limau": { lat: 0.4856, lng: 108.9149 },
  // Sungai Pinyuh
  "Sungai Pinyuh|Sungai Pinyuh": { lat: 0.1896, lng: 109.1499 },
  "Sungai Pinyuh|Galang": { lat: 0.2895, lng: 109.0994 },
  "Sungai Pinyuh|Nusapati": { lat: 0.2570, lng: 109.0915 },
  "Sungai Pinyuh|Peniraman": { lat: 0.2328, lng: 109.1145 },
  "Sungai Pinyuh|Sungai Bakau Besar Laut": { lat: 0.2957, lng: 109.0372 },
  "Sungai Pinyuh|Sungai Batang": { lat: 0.2883, lng: 109.0541 },
  "Sungai Pinyuh|Sungai Purun Kecil": { lat: 0.2148, lng: 109.1435 },
  "Sungai Pinyuh|Sungai Rasau": { lat: 0.3038, lng: 109.0859 },
  "Sungai Pinyuh|Sungai Rasau Besar Darat": { lat: 0.2700, lng: 109.0700 },
  // Toho
  "Toho|Benuang": { lat: 0.3920, lng: 109.2845 },
  "Toho|Kecurit": { lat: 0.3797, lng: 109.1701 },
  "Toho|Pak Laheng": { lat: 0.4167, lng: 109.2238 },
  "Toho|Pak Utan": { lat: 0.4233, lng: 109.2729 },
  "Toho|Sambora": { lat: 0.3465, lng: 109.2812 },
  "Toho|Sepang": { lat: 0.4299, lng: 109.2685 },
  "Toho|Terap": { lat: 0.3990, lng: 109.2025 },
  "Toho|Toho Hilir": { lat: 0.3950, lng: 109.2000 },
};

export const IMPORT_PASSWORD = "dkp2024";

// Default commodity prices per fish type x container type (Pembesaran - Rp/Kg)
// Pembenihan prices are flat per fish type (Rp/Ekor)
export const DEFAULT_COMMODITY_PRICES: Record<string, Record<string, number>> = {
  "Mas": { "KJA": 40000, "Kolam Air Tenang": 38000, "Kolam": 38000, "Kolam Terpal": 38000, "Tambak": 0, "Bioflok": 38000, "KJT": 38000, "Bak Semen": 38000, "Bak Terpal": 38000, "Sawah": 38000 },
  "Nila": { "KJA": 32000, "Kolam Air Tenang": 30000, "Kolam": 30000, "Kolam Terpal": 30000, "Tambak": 30000, "Bioflok": 30000, "KJT": 30000, "Bak Semen": 30000, "Bak Terpal": 30000, "Sawah": 30000 },
  "Lele": { "KJA": 27000, "Kolam Air Tenang": 25000, "Kolam": 25000, "Kolam Terpal": 25000, "Tambak": 0, "Bioflok": 25000, "KJT": 25000, "Bak Semen": 25000, "Bak Terpal": 25000, "Sawah": 25000 },
  "Patin": { "KJA": 42000, "Kolam Air Tenang": 40000, "Kolam": 40000, "Kolam Terpal": 40000, "Tambak": 0, "Bioflok": 40000, "KJT": 40000, "Bak Semen": 40000, "Bak Terpal": 40000, "Sawah": 40000 },
  "Jelawat": { "KJA": 52000, "Kolam Air Tenang": 50000, "Kolam": 50000, "Kolam Terpal": 50000, "Tambak": 0, "Bioflok": 50000, "KJT": 50000, "Bak Semen": 50000, "Bak Terpal": 50000, "Sawah": 50000 },
  "Bawal Air Tawar": { "KJA": 37000, "Kolam Air Tenang": 35000, "Kolam": 35000, "Kolam Terpal": 35000, "Tambak": 0, "Bioflok": 35000, "KJT": 35000, "Bak Semen": 35000, "Bak Terpal": 35000, "Sawah": 35000 },
  "Gurame": { "KJA": 85000, "Kolam Air Tenang": 80000, "Kolam": 80000, "Kolam Terpal": 80000, "Tambak": 0, "Bioflok": 80000, "KJT": 80000, "Bak Semen": 80000, "Bak Terpal": 80000, "Sawah": 80000 },
  "Vaname": { "KJA": 0, "Kolam Air Tenang": 0, "Kolam": 0, "Kolam Terpal": 0, "Tambak": 75000, "Bioflok": 0, "KJT": 0, "Bak Semen": 0, "Bak Terpal": 0, "Sawah": 0 },
  "Lainnya": { "KJA": 30000, "Kolam Air Tenang": 28000, "Kolam": 28000, "Kolam Terpal": 28000, "Tambak": 28000, "Bioflok": 28000, "KJT": 28000, "Bak Semen": 28000, "Bak Terpal": 28000, "Sawah": 28000 },
};

// Default Pembenihan prices (Rp/Ekor) - flat per fish type
export const DEFAULT_PEMBENIHAN_PRICES: Record<string, number> = {
  "Mas": 350,
  "Nila": 350,
  "Lele": 350,
  "Lainnya": 300,
};
