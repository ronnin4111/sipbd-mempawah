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

export const FISH_TYPES = ["Mas", "Nila", "Lele", "Patin", "Jelawat", "Bawal Air Tawar", "Gurame", "Vaname"];

export const CONTAINER_TYPES = ["KJA", "Kolam Air Tenang", "Tambak", "Bioflok", "KJT", "Bak Semen", "Bak Terpal"];

export const BUSINESS_TYPES = ["Pembesaran", "Pembenihan"];

export const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

// Approximate coordinates for each kecamatan center in Kab. Mempawah
export const KECAMATAN_COORDS: Record<string, { lat: number; lng: number }> = {
  "Anjongan": { lat: 0.0833, lng: 109.2167 },
  "Jongkat": { lat: 0.0667, lng: 109.1833 },
  "Mempawah Hilir": { lat: 0.0500, lng: 109.1500 },
  "Mempawah Timur": { lat: 0.0833, lng: 109.2000 },
  "Sadaniang": { lat: 0.1167, lng: 109.2500 },
  "Segedong": { lat: 0.1000, lng: 109.1667 },
  "Sungai Kunyit": { lat: 0.0333, lng: 109.1167 },
  "Sungai Pinyuh": { lat: 0.0167, lng: 109.1000 },
  "Toho": { lat: 0.1333, lng: 109.2833 },
};

export const IMPORT_PASSWORD = "dkp2024";
