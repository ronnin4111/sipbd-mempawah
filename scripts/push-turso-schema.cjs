const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://sipbd-mempawah-ronnin4111.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODA2NTI0MDIsImlhdCI6MTc3ODA2MDQwMiwiaWQiOiIwMTlkZmNhNy0wYTAxLTc2NTYtODhhZC0zMjBiNTVjM2ZmYjYiLCJyaWQiOiIyYWI1NjA2ZC1kMzJhLTQ0MmItYTU5MC0xNWQzYjljOTc1YmIifQ.zGrpac_GfYS-ZPaCaU4T-vG2LeKdci0CVGZ52JMoYWkJLJB0oC5ELPDksVbPAS8Ca07vcWu0tA9WXT2kp5cvCQ',
});

async function main() {
  console.log('=== Current FishFarm columns ===');
  const tableInfo = await client.execute("PRAGMA table_info(FishFarm)");
  for (const row of tableInfo.rows) {
    console.log(`  ${row.name} (${row.type}) - nullable: ${row.notnull === 0}`);
  }

  console.log('\n=== Checking DisaggregationBatch table ===');
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='DisaggregationBatch'");
  if (tables.rows.length > 0) {
    console.log('  DisaggregationBatch table EXISTS');
  } else {
    console.log('  DisaggregationBatch table DOES NOT EXIST - creating...');
  }

  const hasTriwulan = tableInfo.rows.some(r => r.name === 'triwulan');
  if (!hasTriwulan) {
    console.log('\n  Adding triwulan column...');
    await client.execute("ALTER TABLE FishFarm ADD COLUMN triwulan TEXT NOT NULL DEFAULT 'Q4'");
    console.log('  ✓ triwulan column added');
  } else {
    console.log('\n  triwulan column already exists');
  }

  const hasBatchId = tableInfo.rows.some(r => r.name === 'disaggregationBatchId');
  if (!hasBatchId) {
    console.log('  Adding disaggregationBatchId column...');
    await client.execute("ALTER TABLE FishFarm ADD COLUMN disaggregationBatchId TEXT");
    console.log('  ✓ disaggregationBatchId column added');
  } else {
    console.log('  disaggregationBatchId column already exists');
  }

  if (tables.rows.length === 0) {
    await client.execute(`
      CREATE TABLE DisaggregationBatch (
        id TEXT PRIMARY KEY NOT NULL,
        year INTEGER NOT NULL,
        triwulan TEXT NOT NULL,
        kecamatan TEXT NOT NULL,
        fishType TEXT NOT NULL,
        containerType TEXT NOT NULL,
        businessType TEXT NOT NULL,
        totalQty REAL NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ DisaggregationBatch table created');
  }

  console.log('\n=== Final FishFarm columns ===');
  const finalInfo = await client.execute("PRAGMA table_info(FishFarm)");
  for (const row of finalInfo.rows) {
    console.log(`  ${row.name} (${row.type})`);
  }

  console.log('\n=== DisaggregationBatch columns ===');
  const batchInfo = await client.execute("PRAGMA table_info(DisaggregationBatch)");
  for (const row of batchInfo.rows) {
    console.log(`  ${row.name} (${row.type})`);
  }

  console.log('\n✅ Schema migration complete!');
}

main().catch(err => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
