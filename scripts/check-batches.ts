import { db } from '../src/lib/db';

async function main() {
  const batches = await db.disaggregationBatch.findMany({
    where: { year: 2026 },
    include: { _count: { select: { fishFarms: true } } },
    orderBy: { createdAt: 'asc' },
  });
  
  console.log('=== All DisaggregationBatch for year=2026 ===');
  for (const b of batches) {
    console.log(`  ${b.triwulan} | ${b.businessType} | totalQty=${b.totalQty} | fishFarms=${b._count.fishFarms} | createdAt=${b.createdAt.toISOString()} | id=${b.id}`);
  }
  
  // Also count FishFarm records per triwulan
  console.log('\n=== FishFarm count per triwulan (year=2026) ===');
  for (const tw of ['Q1', 'Q2', 'Q3', 'Q4']) {
    const count = await db.fishFarm.count({ where: { year: 2026, triwulan: tw } });
    const sum = await db.fishFarm.aggregate({ where: { year: 2026, triwulan: tw }, _sum: { productionQty: true } });
    console.log(`  ${tw}: ${count} records, sum(productionQty)=${sum._sum.productionQty ?? 0}`);
  }
  
  // Check FishFarms with disaggregationBatchId
  const linkedCount = await db.fishFarm.count({ where: { year: 2026, disaggregationBatchId: { not: null } } });
  const unlinkedCount = await db.fishFarm.count({ where: { year: 2026, disaggregationBatchId: null } });
  console.log(`\n=== FishFarm linkage (year=2026) ===`);
  console.log(`  Linked to batch: ${linkedCount}`);
  console.log(`  Unlinked (batchId=null): ${unlinkedCount}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
