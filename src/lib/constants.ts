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

// Approximate coordinates for each kecamatan center in Kab. Mempawah
export const KECAMATAN_COORDS: Record<string, { lat: number; lng: number }> = {
  "Anjongan": { lat: 0.3561, lng: 109.1754 },
  "Jongkat": { lat: 0.0698, lng: 109.1943 },
  "Mempawah Hilir": { lat: 0.3674, lng: 108.9514 },
  "Mempawah Timur": { lat: 0.3672, lng: 108.9778 },
  "Sadaniang": { lat: 0.5277, lng: 109.1519 },
  "Segedong": { lat: 0.1531, lng: 109.1871 },
  "Sungai Kunyit": { lat: 0.4998, lng: 108.9112 },
  "Sungai Pinyuh": { lat: 0.2758, lng: 109.0860 },
  "Toho": { lat: 0.4149, lng: 109.2225 },
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
