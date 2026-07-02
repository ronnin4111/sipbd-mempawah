import { db } from '../src/lib/db';

async function main() {
  console.log('=== Cleaning up duplicate DisaggregationBatch records ===\n');
  
  // 1. Fetch ALL batches, sorted by createdAt DESC (latest first)
  const allBatches = await db.disaggregationBatch.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, year: true, triwulan: true, businessType: true, totalQty: true, createdAt: true },
  });
  
  console.log(`Total batches found: ${allBatches.length}\n`);
  
  // 2. Group by (year, triwulan, businessType) and identify old duplicates to delete
  const seenKeys = new Set<string>();
  const toDelete: string[] = [];
  const toKeep: string[] = [];
  
  for (const b of allBatches) {
    const key = `${b.year}|${b.triwulan}|${b.businessType}`;
    if (seenKeys.has(key)) {
      // This is an old duplicate — mark for deletion
      toDelete.push(b.id);
      console.log(`  ❌ DELETE: ${b.triwulan} ${b.businessType} year=${b.year} totalQty=${b.totalQty} createdAt=${b.createdAt.toISOString()} id=${b.id}`);
    } else {
      // This is the latest batch for this (year, triwulan, businessType) — keep it
      seenKeys.add(key);
      toKeep.push(b.id);
      console.log(`  ✅ KEEP:   ${b.triwulan} ${b.businessType} year=${b.year} totalQty=${b.totalQty} createdAt=${b.createdAt.toISOString()} id=${b.id}`);
    }
  }
  
  console.log(`\nSummary: ${toKeep.length} to keep, ${toDelete.length} to delete`);
  
  if (toDelete.length === 0) {
    console.log('\n✅ No duplicate batches found. Nothing to clean up.');
    return;
  }
  
  // 3. Delete FishFarm records linked to old batches (if any)
  console.log(`\nDeleting FishFarm records linked to ${toDelete.length} old batches...`);
  const fishFarmResult = await db.fishFarm.deleteMany({
    where: { disaggregationBatchId: { in: toDelete } },
  });
  console.log(`  Deleted ${fishFarmResult.count} FishFarm records`);
  
  // 4. Delete the old batch records
  console.log(`\nDeleting ${toDelete.length} old DisaggregationBatch records...`);
  const batchResult = await db.disaggregationBatch.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`  Deleted ${batchResult.count} DisaggregationBatch records`);
  
  // 5. Verify the result
  console.log('\n=== Verification: remaining batches ===');
  const remaining = await db.disaggregationBatch.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, year: true, triwulan: true, businessType: true, totalQty: true, createdAt: true },
  });
  for (const b of remaining) {
    console.log(`  ${b.triwulan} | ${b.businessType} | year=${b.year} | totalQty=${b.totalQty} | createdAt=${b.createdAt.toISOString()}`);
  }
  
  // 6. Show what the triwulan-status API would now return
  console.log('\n=== Expected triwulan-status after cleanup ===');
  const byTw = new Map<string, number>();
  for (const b of remaining) {
    byTw.set(b.triwulan, (byTw.get(b.triwulan) || 0) + b.totalQty);
  }
  for (const tw of ['Q1', 'Q2', 'Q3', 'Q4']) {
    console.log(`  ${tw}: ${byTw.get(tw) || 0} Kg`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
