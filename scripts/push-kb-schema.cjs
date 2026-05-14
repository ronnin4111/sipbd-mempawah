const { createClient } = require('@libsql/client');

// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
  console.error('   Create a .env.local file with these values');
  process.exit(1);
}

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

async function main() {
  console.log('=== Pushing Knowledge Base tables to Turso ===\n');

  // Check existing tables
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('KnowledgeDocument', 'KnowledgeChunk')");
  const existingTables = new Set(tables.rows.map(r => r.name));

  // Create KnowledgeDocument table
  if (!existingTables.has('KnowledgeDocument')) {
    console.log('Creating KnowledgeDocument table...');
    await client.execute(`
      CREATE TABLE KnowledgeDocument (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        fileType TEXT NOT NULL,
        fileSize INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'umum',
        contentHash TEXT NOT NULL DEFAULT '',
        totalChunks INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        uploadedBy TEXT NOT NULL DEFAULT 'admin',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ KnowledgeDocument table created');

    // Create indexes
    await client.execute('CREATE INDEX idx_knowledge_document_category ON KnowledgeDocument(category)');
    await client.execute('CREATE INDEX idx_knowledge_document_isActive ON KnowledgeDocument(isActive)');
    await client.execute('CREATE INDEX idx_knowledge_document_contentHash ON KnowledgeDocument(contentHash)');
    console.log('  ✓ Indexes created');
  } else {
    console.log('  KnowledgeDocument table already exists');
  }

  // Create KnowledgeChunk table
  if (!existingTables.has('KnowledgeChunk')) {
    console.log('Creating KnowledgeChunk table...');
    await client.execute(`
      CREATE TABLE KnowledgeChunk (
        id TEXT PRIMARY KEY NOT NULL,
        documentId TEXT NOT NULL,
        chunkIndex INTEGER NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        keywords TEXT NOT NULL DEFAULT '',
        accessCount INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES KnowledgeDocument(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✓ KnowledgeChunk table created');

    // Create indexes
    await client.execute('CREATE INDEX idx_knowledge_chunk_documentId ON KnowledgeChunk(documentId)');
    await client.execute('CREATE INDEX idx_knowledge_chunk_chunkIndex ON KnowledgeChunk(chunkIndex)');
    await client.execute('CREATE INDEX idx_knowledge_chunk_keywords ON KnowledgeChunk(keywords)');
    console.log('  ✓ Indexes created');
  } else {
    console.log('  KnowledgeChunk table already exists');
  }

  // Verify
  console.log('\n=== Verification ===');
  const docInfo = await client.execute("PRAGMA table_info(KnowledgeDocument)");
  console.log('KnowledgeDocument columns:');
  for (const row of docInfo.rows) {
    console.log(`  ${row.name} (${row.type})`);
  }

  const chunkInfo = await client.execute("PRAGMA table_info(KnowledgeChunk)");
  console.log('\nKnowledgeChunk columns:');
  for (const row of chunkInfo.rows) {
    console.log(`  ${row.name} (${row.type})`);
  }

  console.log('\n✅ Knowledge Base schema pushed to Turso successfully!');
}

main().catch(err => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
