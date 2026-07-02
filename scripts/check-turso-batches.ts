import { db } from '../src/lib/db';

async function main() {
  const batches = await db.disaggregationBatch.findMany({
    where: { year: 2026 },
    include: { _count: { select: { fishFarms: true } } },
    orderBy: { createdAt: 'asc' },
  });
  
  console.log('=== All DisaggregationBatch for year=2026 (Turso) ===');
  console.log(`Total batches: ${batches.length}\n`);
  for (const b of batches) {
    console.log(`  ${b.triwulan} | ${b.businessType} | totalQty=${b.totalQty} | fishFarms=${b._count.fishFarms} | createdAt=${b.createdAt.toISOString()} | id=${b.id}`);
  }
  
  console.log('\n=== FishFarm count per triwulan (year=2026) ===');
  for (const tw of ['Q1', 'Q2', 'Q3', 'Q4']) {
    const count = await db.fishFarm.count({ where: { year: 2026, triwulan: tw } });
    const sum = await db.fishFarm.aggregate({ where: { year: 2026, triwulan: tw }, _sum: { productionQty: true } });
    console.log(`  ${tw}: ${count} records, sum(productionQty)=${sum._sum.productionQty ?? 0}`);
  }
  
  const linkedCount = await db.fishFarm.count({ where: { year: 2026, disaggregationBatchId: { not: null } } });
  const unlinkedCount = await db.fishFarm.count({ where: { year: 2026, disaggregationBatchId: null } });
  console.log(`\n=== FishFarm linkage (year=2026) ===`);
  console.log(`  Linked to batch: ${linkedCount}`);
  console.log(`  Unlinked (batchId=null): ${unlinkedCount}`);
  
  // Show correct totals (latest batch per triwulan+businessType)
  console.log('\n=== Correct totals (latest batch per triwulan+businessType) ===');
  const byTwBt = new Map<string, typeof batches>();
  for (const b of batches) {
    const key = `${b.triwulan}|${b.businessType}`;
    if (!byTwBt.has(key)) byTwBt.set(key, []);
    byTwBt.get(key)!.push(b);
  }
  const correctByTw: Record<string, number> = {};
  for (const [key, bs] of byTwBt) {
    bs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = bs[0];
    const [tw] = key.split('|');
    correctByTw[tw] = (correctByTw[tw] || 0) + latest.totalQty;
    console.log(`  ${key}: latest=${latest.totalQty} (createdAt=${latest.createdAt.toISOString()}), old=${bs.slice(1).map(b=>b.totalQty).join(', ') || 'none'}`);
  }
  console.log('\n  Correct per-triwulan totals:');
  for (const tw of ['Q1','Q2','Q3','Q4']) {
    console.log(`    ${tw}: ${correctByTw[tw] || 0}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
