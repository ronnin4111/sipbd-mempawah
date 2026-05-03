import { PrismaClient } from '@prisma/client';
import { KECAMATAN_DESA, FISH_TYPES, CONTAINER_TYPES, BUSINESS_TYPES, YEARS, KECAMATAN_COORDS } from '../src/lib/constants';

const prisma = new PrismaClient();

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function main() {
  await prisma.fishFarm.deleteMany();

  const rand = seededRandom(42);
  const allEntries: { kecamatan: string; desa: string; fishType: string; containerType: string; businessType: string; year: number }[] = [];

  // Generate diverse combinations across kecamatan/desa
  const kecamatanList = Object.keys(KECAMATAN_DESA);
  
  // Generate 150 records with good distribution
  for (let i = 0; i < 150; i++) {
    const kecIdx = Math.floor(rand() * kecamatanList.length);
    const kecamatan = kecamatanList[kecIdx];
    const desaList = KECAMATAN_DESA[kecamatan];
    const desaIdx = Math.floor(rand() * desaList.length);
    const desa = desaList[desaIdx].desa;
    const fishIdx = Math.floor(rand() * FISH_TYPES.length);
    const fishType = FISH_TYPES[fishIdx];
    const containerIdx = Math.floor(rand() * CONTAINER_TYPES.length);
    const containerType = CONTAINER_TYPES[containerIdx];
    const businessIdx = Math.floor(rand() * BUSINESS_TYPES.length);
    const businessType = BUSINESS_TYPES[businessIdx];
    const yearIdx = Math.floor(rand() * YEARS.length);
    const year = YEARS[yearIdx];

    allEntries.push({ kecamatan, desa, fishType, containerType, businessType, year });
  }

  // Create records
  for (const entry of allEntries) {
    const coords = KECAMATAN_COORDS[entry.kecamatan];
    // Add some variation to coordinates based on desa
    const desaList = KECAMATAN_DESA[entry.kecamatan];
    const desaIdx = desaList.findIndex(d => d.desa === entry.desa);
    const latOffset = (desaIdx * 0.003) + (rand() - 0.5) * 0.005;
    const lngOffset = (desaIdx * 0.003) + (rand() - 0.5) * 0.005;

    // Production quantities vary by fish type and business type
    let baseProd = 500 + rand() * 9500; // 500-10000 kg
    if (entry.businessType === "Pembenihan") {
      baseProd = 50 + rand() * 2950; // 50-3000 ekor
    }
    if (entry.fishType === "Lele") baseProd *= 1.3;
    if (entry.fishType === "Nila") baseProd *= 1.2;
    if (entry.fishType === "Mas") baseProd *= 1.1;

    // Container type affects production
    if (entry.containerType === "KJA") baseProd *= 1.4;
    if (entry.containerType === "Bioflok") baseProd *= 1.2;
    if (entry.containerType === "Bak Terpal") baseProd *= 0.6;

    // Year trend - increasing production
    const yearFactor = 1 + (entry.year - 2020) * 0.08;
    baseProd *= yearFactor;

    const productionQty = Math.round(baseProd * 100) / 100;
    const targetQty = Math.round((productionQty * (0.85 + rand() * 0.35)) * 100) / 100;
    
    // Price per kg varies by fish type
    const pricePerKg: Record<string, number> = {
      "Mas": 28000, "Nila": 22000, "Lele": 18000, "Patin": 25000,
      "Jelawat": 35000, "Bawal Air Tawar": 30000, "Gurame": 55000
    };
    const price = pricePerKg[entry.fishType] || 25000;
    const productionValue = Math.round(productionQty * price);

    // RTP, farmer, group counts
    const rtpCount = Math.max(1, Math.round(5 + rand() * 45));
    const farmerCount = Math.max(1, Math.round(rtpCount * (0.7 + rand() * 0.3)));
    const groupCount = Math.max(1, Math.round(1 + rand() * 5));

    // Farmer and group names
    const farmerNames = [
      "Ahmad Suryadi", "Budi Santoso", "Dahlan", "Eko Prasetyo", "Fajar Nugroho",
      "Gunawan", "Hendra Wijaya", "Irfan Hakim", "Joko Susilo", "Kasmadi",
      "Lukman Hakim", "Muhammad Rizki", "Nurdin", "Omar Faruk", "Purnomo",
      "Rahmat Hidayat", "Surya Darma", "Taufik Rahman", "Umar Said", "Wahyu Pratama",
      "Yusuf Ibrahim", "Zainal Abidin", "Agus Salim", "Basri", "Chairul Anwar",
    ];
    const groupNames = [
      "Mina Sejahtera", "Mina Makmur", "Mina Jaya", "Mina Bersama", "Mina Mandiri",
      "Pokdakan Makmur", "Pokdakan Sejahtera", "Pokdakan Jaya", "Pokdakan Bersatu",
      "Kelompok Tani Mina", "Kelompok Budidaya Lestari", "Kelompok Mina Bahari",
      "Kelompok Mina Sentosa", "Kelompok Mina Harapan", "Kelompok Mina Utama",
    ];
    const farmerName = farmerNames[Math.floor(rand() * farmerNames.length)];
    const groupName = groupNames[Math.floor(rand() * groupNames.length)];

    await prisma.fishFarm.create({
      data: {
        year: entry.year,
        kecamatan: entry.kecamatan,
        desa: entry.desa,
        fishType: entry.fishType,
        containerType: entry.containerType,
        businessType: entry.businessType,
        farmerName,
        groupName,
        productionQty,
        rtpCount,
        farmerCount,
        groupCount,
        targetQty,
        productionValue,
        latitude: coords.lat + latOffset,
        longitude: coords.lng + lngOffset,
      },
    });
  }

  console.log(`Seeded ${allEntries.length} fish farm records`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
