/**
 * Runtime database initialization for Turso/SQLite.
 *
 * `prisma db push` does NOT work with Turso's libsql:// URLs because
 * the Prisma CLI's SQLite provider only understands file: paths.
 * The only way Prisma connects to Turso is through the adapter at runtime.
 *
 * This module uses `db.$executeRawUnsafe()` to create tables via raw SQL
 * through the same Prisma Client + adapter connection that works for CRUD.
 */

import { db } from '@/lib/db';

// Track initialization state in memory (persists across requests in same cold start)
let initialized = false;
let initPromise: Promise<void> | null = null;

const CREATE_TABLES_SQL = [
  // Penyuluh table
  `CREATE TABLE IF NOT EXISTS Penyuluh (
    id TEXT PRIMARY KEY NOT NULL,
    nama TEXT NOT NULL,
    nip TEXT NOT NULL DEFAULT '',
    pangkatGolRuang TEXT NOT NULL DEFAULT '',
    jabatan TEXT NOT NULL DEFAULT '',
    fotoUrl TEXT NOT NULL DEFAULT '',
    noWa TEXT NOT NULL DEFAULT '',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS Penyuluh_nama_idx ON Penyuluh(nama)`,

  // Pegawai table
  `CREATE TABLE IF NOT EXISTS Pegawai (
    id TEXT PRIMARY KEY NOT NULL,
    nama TEXT NOT NULL,
    nip TEXT NOT NULL DEFAULT '',
    pangkatGolRuang TEXT NOT NULL DEFAULT '',
    jabatan TEXT NOT NULL DEFAULT '',
    fotoUrl TEXT NOT NULL DEFAULT '',
    noWa TEXT NOT NULL DEFAULT '',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS Pegawai_nama_idx ON Pegawai(nama)`,

  // AppSetting table (used for passwords, social media accounts, etc.)
  `CREATE TABLE IF NOT EXISTS AppSetting (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // SocialMediaPost table
  `CREATE TABLE IF NOT EXISTS SocialMediaPost (
    id TEXT PRIMARY KEY NOT NULL,
    platform TEXT NOT NULL,
    postUrl TEXT NOT NULL,
    embedUrl TEXT NOT NULL DEFAULT '',
    caption TEXT NOT NULL DEFAULT '',
    thumbnailUrl TEXT NOT NULL DEFAULT '',
    isPinned INTEGER NOT NULL DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    addedBy TEXT NOT NULL DEFAULT 'admin',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS SocialMediaPost_platform_idx ON SocialMediaPost(platform)`,
  `CREATE INDEX IF NOT EXISTS SocialMediaPost_isActive_idx ON SocialMediaPost(isActive)`,
  `CREATE INDEX IF NOT EXISTS SocialMediaPost_sortOrder_idx ON SocialMediaPost(sortOrder)`,

  // ==========================================
  // NEW TABLES — added for complete schema
  // ==========================================

  // DisaggregationBatch — must be created BEFORE FishFarm (FK dependency)
  `CREATE TABLE IF NOT EXISTS DisaggregationBatch (
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
  )`,

  // FishFarm table
  `CREATE TABLE IF NOT EXISTS FishFarm (
    id TEXT PRIMARY KEY NOT NULL,
    farmerId TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL,
    triwulan TEXT NOT NULL DEFAULT 'Q4',
    kecamatan TEXT NOT NULL,
    desa TEXT NOT NULL,
    fishType TEXT NOT NULL,
    containerType TEXT NOT NULL,
    businessType TEXT NOT NULL,
    farmerName TEXT NOT NULL DEFAULT '',
    groupName TEXT NOT NULL DEFAULT '',
    productionQty REAL NOT NULL,
    rtpCount INTEGER NOT NULL,
    farmerCount INTEGER NOT NULL,
    groupCount INTEGER NOT NULL,
    targetQty REAL NOT NULL,
    productionValue REAL NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    kusuka TEXT NOT NULL DEFAULT '',
    cpib INTEGER NOT NULL DEFAULT 0,
    cbib INTEGER NOT NULL DEFAULT 0,
    disaggregationBatchId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (disaggregationBatchId) REFERENCES DisaggregationBatch(id)
  )`,
  `CREATE INDEX IF NOT EXISTS FishFarm_kecamatan_idx ON FishFarm(kecamatan)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_desa_idx ON FishFarm(desa)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_fishType_idx ON FishFarm(fishType)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_businessType_idx ON FishFarm(businessType)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_year_idx ON FishFarm(year)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_farmerId_idx ON FishFarm(farmerId)`,

  // CommodityPrice table
  `CREATE TABLE IF NOT EXISTS CommodityPrice (
    id TEXT PRIMARY KEY NOT NULL,
    fishType TEXT NOT NULL,
    containerType TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fishType, containerType)
  )`,

  // ChatMemory table
  `CREATE TABLE IF NOT EXISTS ChatMemory (
    id TEXT PRIMARY KEY NOT NULL,
    sessionId TEXT NOT NULL DEFAULT 'default',
    category TEXT NOT NULL DEFAULT 'fact',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'user_told',
    accessCount INTEGER NOT NULL DEFAULT 0,
    lastAccessedAt DATETIME,
    expiresAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS ChatMemory_sessionId_category_idx ON ChatMemory(sessionId, category)`,
  `CREATE INDEX IF NOT EXISTS ChatMemory_sessionId_key_idx ON ChatMemory(sessionId, key)`,
  `CREATE INDEX IF NOT EXISTS ChatMemory_expiresAt_idx ON ChatMemory(expiresAt)`,

  // KusukaRegistration table
  `CREATE TABLE IF NOT EXISTS KusukaRegistration (
    id TEXT PRIMARY KEY NOT NULL,
    nama TEXT NOT NULL,
    provinsi TEXT NOT NULL DEFAULT 'KALIMANTAN BARAT',
    kabKota TEXT NOT NULL DEFAULT 'MEMPAWAH',
    kecamatan TEXT NOT NULL,
    kelDesa TEXT NOT NULL,
    noKusuka TEXT NOT NULL DEFAULT '',
    namaKelompok TEXT NOT NULL DEFAULT '',
    bentukUsaha TEXT NOT NULL DEFAULT 'Perseorangan',
    profesiUtama TEXT NOT NULL DEFAULT 'Subsektor Pembudidaya Ikan',
    alamat TEXT NOT NULL DEFAULT '',
    tglDibuat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dibuatOleh TEXT NOT NULL DEFAULT '',
    tglDiperbaharui DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbaharuiOleh TEXT NOT NULL DEFAULT '',
    divalidasiOleh TEXT NOT NULL DEFAULT '',
    tglDivalidasi DATETIME,
    statusKusuka TEXT NOT NULL DEFAULT 'Valid',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_kecamatan_idx ON KusukaRegistration(kecamatan)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_kelDesa_idx ON KusukaRegistration(kelDesa)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_namaKelompok_idx ON KusukaRegistration(namaKelompok)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_noKusuka_idx ON KusukaRegistration(noKusuka)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_statusKusuka_idx ON KusukaRegistration(statusKusuka)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_profesiUtama_idx ON KusukaRegistration(profesiUtama)`,

  // KnowledgeDocument table
  `CREATE TABLE IF NOT EXISTS KnowledgeDocument (
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
  )`,
  `CREATE INDEX IF NOT EXISTS KnowledgeDocument_category_idx ON KnowledgeDocument(category)`,
  `CREATE INDEX IF NOT EXISTS KnowledgeDocument_isActive_idx ON KnowledgeDocument(isActive)`,
  `CREATE INDEX IF NOT EXISTS KnowledgeDocument_contentHash_idx ON KnowledgeDocument(contentHash)`,

  // KnowledgeChunk table
  `CREATE TABLE IF NOT EXISTS KnowledgeChunk (
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
  )`,
  `CREATE INDEX IF NOT EXISTS KnowledgeChunk_documentId_idx ON KnowledgeChunk(documentId)`,
  `CREATE INDEX IF NOT EXISTS KnowledgeChunk_chunkIndex_idx ON KnowledgeChunk(chunkIndex)`,
  `CREATE INDEX IF NOT EXISTS KnowledgeChunk_keywords_idx ON KnowledgeChunk(keywords)`,

  // PushSubscription table (for web push notifications)
  `CREATE TABLE IF NOT EXISTS PushSubscription (
    id TEXT PRIMARY KEY NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL DEFAULT '',
    auth TEXT NOT NULL DEFAULT '',
    userId TEXT NOT NULL DEFAULT 'admin',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

const ALTER_TABLES_SQL = [
  // Add fotoUrl and noWa columns if they don't exist (for existing Turso tables)
  `ALTER TABLE Penyuluh ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Penyuluh ADD COLUMN noWa TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Pegawai ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Pegawai ADD COLUMN noWa TEXT NOT NULL DEFAULT ''`,

  // FishFarm — add newer columns in case table exists but was created before these were added
  `ALTER TABLE FishFarm ADD COLUMN farmerId TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE FishFarm ADD COLUMN kusuka TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE FishFarm ADD COLUMN cpib INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE FishFarm ADD COLUMN cbib INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE FishFarm ADD COLUMN disaggregationBatchId TEXT`,
];

/**
 * Ensure all required tables exist in the database.
 * Safe to call multiple times — uses CREATE IF NOT EXISTS.
 * Deduplicates concurrent calls.
 */
export async function ensureTablesExist(): Promise<void> {
  if (initialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Create tables (idempotent)
        for (const sql of CREATE_TABLES_SQL) {
          await db.$executeRawUnsafe(sql);
        }

        // Try to add new columns (will fail silently if column already exists)
        for (const sql of ALTER_TABLES_SQL) {
          try {
            await db.$executeRawUnsafe(sql);
          } catch {
            // Column already exists — expected for existing databases
          }
        }

        // Initialize default passwords if not set
        try {
          const adminPwd = await db.$executeRawUnsafe(
            `INSERT OR IGNORE INTO AppSetting (key, value, updatedAt) VALUES ('password_admin', 'sipbd2024', CURRENT_TIMESTAMP)`
          );
          const exportPwd = await db.$executeRawUnsafe(
            `INSERT OR IGNORE INTO AppSetting (key, value, updatedAt) VALUES ('password_export', 'sipbd2024', CURRENT_TIMESTAMP)`
          );
          console.log('[db-init] 🔑 Default passwords initialized in database');
        } catch (pwdErr) {
          console.warn('[db-init] ⚠️ Could not initialize default passwords:', pwdErr);
        }

        initialized = true;
        console.log('[db-init] ✅ Tables ensured successfully');
      } catch (error) {
        console.error('[db-init] ❌ Failed to create tables:', error);
        initPromise = null; // Allow retry
        throw error;
      }
    })();
  }

  return initPromise;
}

/**
 * Check if a specific table exists by trying to query it.
 * Returns true if table exists and is accessible.
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}
