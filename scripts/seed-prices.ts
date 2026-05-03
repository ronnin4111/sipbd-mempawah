import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PRICES: Record<string, Record<string, number>> = {
  "Lele": { "KJA": 23000, "Kolam Air Tenang": 21000, "Tambak": 0, "Bioflok": 21000, "KJT": 21000, "Bak Terpal": 21000, "Bak Semen": 21000 },
  "Nila": { "KJA": 38000, "Kolam Air Tenang": 35000, "Tambak": 35000, "Bioflok": 35000, "KJT": 35000, "Bak Terpal": 35000, "Bak Semen": 35000 },
  "Bawal Air Tawar": { "KJA": 25000, "Kolam Air Tenang": 25000, "Tambak": 0, "Bioflok": 25000, "KJT": 25000, "Bak Terpal": 25000, "Bak Semen": 25000 },
  "Jelawat": { "KJA": 50000, "Kolam Air Tenang": 50000, "Tambak": 0, "Bioflok": 50000, "KJT": 50000, "Bak Terpal": 50000, "Bak Semen": 50000 },
  "Gurame": { "KJA": 45000, "Kolam Air Tenang": 45000, "Tambak": 0, "Bioflok": 45000, "KJT": 45000, "Bak Terpal": 45000, "Bak Semen": 45000 },
  "Patin": { "KJA": 25000, "Kolam Air Tenang": 22000, "Tambak": 0, "Bioflok": 22000, "KJT": 22000, "Bak Terpal": 22000, "Bak Semen": 22000 },
  "Mas": { "KJA": 40000, "Kolam Air Tenang": 38000, "Tambak": 0, "Bioflok": 38000, "KJT": 38000, "Bak Terpal": 38000, "Bak Semen": 38000 },
  "Vaname": { "KJA": 0, "Kolam Air Tenang": 0, "Tambak": 75000, "Bioflok": 0, "KJT": 0, "Bak Terpal": 0, "Bak Semen": 0 },
};

async function main() {
  console.log('Seeding commodity prices...');

  for (const [fishType, containers] of Object.entries(DEFAULT_PRICES)) {
    for (const [containerType, price] of Object.entries(containers)) {
      await prisma.commodityPrice.upsert({
        where: {
          fishType_containerType: { fishType, containerType },
        },
        update: { price },
        create: { fishType, containerType, price },
      });
    }
  }

  const count = await prisma.commodityPrice.count();
  console.log(`Done! ${count} commodity prices seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
