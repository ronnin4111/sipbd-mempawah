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
  `CREATE INDEX IF NOT EXISTS FishFarm_containerType_idx ON FishFarm(containerType)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_groupName_idx ON FishFarm(groupName)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_year_kecamatan_idx ON FishFarm(year, kecamatan)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_year_businessType_idx ON FishFarm(year, businessType)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_year_triwulan_idx ON FishFarm(year, triwulan)`,
  `CREATE INDEX IF NOT EXISTS FishFarm_disaggregationBatchId_idx ON FishFarm(disaggregationBatchId)`,

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
  `CREATE INDEX IF NOT EXISTS ChatMemory_sessionId_updatedAt_idx ON ChatMemory(sessionId, updatedAt)`,
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
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_bentukUsaha_idx ON KusukaRegistration(bentukUsaha)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_nama_idx ON KusukaRegistration(nama)`,
  `CREATE INDEX IF NOT EXISTS KusukaRegistration_tglDibuat_idx ON KusukaRegistration(tglDibuat)`,

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
  `CREATE INDEX IF NOT EXISTS KnowledgeDocument_isActive_createdAt_idx ON KnowledgeDocument(isActive, createdAt)`,
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
  `CREATE INDEX IF NOT EXISTS KnowledgeChunk_documentId_chunkIndex_idx ON KnowledgeChunk(documentId, chunkIndex)`,

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
  `CREATE UNIQUE INDEX IF NOT EXISTS PushSubscription_endpoint_key ON PushSubscription(endpoint)`,
  `CREATE INDEX IF NOT EXISTS PushSubscription_userId_idx ON PushSubscription(userId)`,

  // AnalyzeUpload — stores metadata for uploaded Excel analysis data
  `CREATE TABLE IF NOT EXISTS AnalyzeUpload (
    id TEXT PRIMARY KEY NOT NULL,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL DEFAULT 0,
    fileName TEXT NOT NULL,
    fileSize INTEGER NOT NULL DEFAULT 0,
    businessType TEXT NOT NULL DEFAULT 'Pembesaran',
    uploadedBy TEXT NOT NULL DEFAULT 'admin',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // AnalyzeRow — individual data rows from uploaded Excel
  `CREATE TABLE IF NOT EXISTS AnalyzeRow (
    id TEXT PRIMARY KEY NOT NULL,
    uploadId TEXT NOT NULL,
    bulan TEXT NOT NULL,
    bulanNum INTEGER NOT NULL DEFAULT 1,
    tw INTEGER NOT NULL DEFAULT 1,
    semester INTEGER NOT NULL DEFAULT 1,
    jenisWadah TEXT NOT NULL,
    komoditas TEXT NOT NULL,
    produksiTon REAL NOT NULL DEFAULT 0,
    produksiKg REAL NOT NULL DEFAULT 0,
    produktifitas REAL NOT NULL DEFAULT 0,
    luasLahan REAL NOT NULL DEFAULT 0,
    hargaRpKg REAL NOT NULL DEFAULT 0,
    nilaiRp REAL NOT NULL DEFAULT 0,
    fcr REAL NOT NULL DEFAULT 0,
    pakanKg REAL NOT NULL DEFAULT 0,
    size REAL NOT NULL DEFAULT 0,
    sr REAL NOT NULL DEFAULT 0,
    agregatBenih REAL NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploadId) REFERENCES AnalyzeUpload(id) ON DELETE CASCADE
  )`,

  // AnalyzePopulasi — population data per wadah from uploaded Excel
  `CREATE TABLE IF NOT EXISTS AnalyzePopulasi (
    id TEXT PRIMARY KEY NOT NULL,
    uploadId TEXT NOT NULL,
    jenisWadah TEXT NOT NULL,
    jumlahRtp INTEGER NOT NULL DEFAULT 0,
    jumlahPembudidaya INTEGER NOT NULL DEFAULT 0,
    luasLahan REAL NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploadId) REFERENCES AnalyzeUpload(id) ON DELETE CASCADE
  )`,

  // Indexes for AnalyzeRow
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_uploadId ON AnalyzeRow(uploadId)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_tw ON AnalyzeRow(tw)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_semester ON AnalyzeRow(semester)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_komoditas ON AnalyzeRow(komoditas)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_jenisWadah ON AnalyzeRow(jenisWadah)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_bulanNum ON AnalyzeRow(bulanNum)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_uploadId_semester ON AnalyzeRow(uploadId, semester)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_uploadId_bulanNum ON AnalyzeRow(uploadId, bulanNum)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_row_uploadId_komoditas_jenisWadah ON AnalyzeRow(uploadId, komoditas, jenisWadah)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_upload_year ON AnalyzeUpload(year)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_upload_semester ON AnalyzeUpload(semester)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_upload_year_createdAt ON AnalyzeUpload(year, createdAt)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_populasi_uploadId ON AnalyzePopulasi(uploadId)`,
  `CREATE INDEX IF NOT EXISTS idx_analyze_populasi_jenisWadah ON AnalyzePopulasi(jenisWadah)`,

  // DisaggregationBatch createdAt index (for ORDER BY createdAt DESC)
  `CREATE INDEX IF NOT EXISTS DisaggregationBatch_createdAt_idx ON DisaggregationBatch(createdAt)`,
];

const ALTER_TABLES_SQL = [
  // Add fotoUrl and noWa columns if they don't exist (for existing Turso tables)
  { table: 'Penyuluh', column: 'fotoUrl', sql: `ALTER TABLE Penyuluh ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''` },
  { table: 'Penyuluh', column: 'noWa', sql: `ALTER TABLE Penyuluh ADD COLUMN noWa TEXT NOT NULL DEFAULT ''` },
  { table: 'Pegawai', column: 'fotoUrl', sql: `ALTER TABLE Pegawai ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''` },
  { table: 'Pegawai', column: 'noWa', sql: `ALTER TABLE Pegawai ADD COLUMN noWa TEXT NOT NULL DEFAULT ''` },

  // FishFarm — add newer columns in case table exists but was created before these were added
  { table: 'FishFarm', column: 'farmerId', sql: `ALTER TABLE FishFarm ADD COLUMN farmerId TEXT NOT NULL DEFAULT ''` },
  { table: 'FishFarm', column: 'kusuka', sql: `ALTER TABLE FishFarm ADD COLUMN kusuka TEXT NOT NULL DEFAULT ''` },
  { table: 'FishFarm', column: 'cpib', sql: `ALTER TABLE FishFarm ADD COLUMN cpib INTEGER NOT NULL DEFAULT 0` },
  { table: 'FishFarm', column: 'cbib', sql: `ALTER TABLE FishFarm ADD COLUMN cbib INTEGER NOT NULL DEFAULT 0` },
  { table: 'FishFarm', column: 'disaggregationBatchId', sql: `ALTER TABLE FishFarm ADD COLUMN disaggregationBatchId TEXT` },
];

/**
 * Check if a column exists in a table using PRAGMA table_info.
 * SQLite has no `ALTER TABLE ADD COLUMN IF NOT EXISTS` clause, so we must
 * check existence manually before ALTER — otherwise it errors with
 * "duplicate column name" on every server start.
 *
 * Uses db.$queryRawUnsafe to get actual rows back (PRAGMA returns a result set).
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    // PRAGMA table_info returns rows: [{ name: 'id', ... }, { name: 'nama', ... }, ...]
    // We use $queryRawUnsafe because $executeRawUnsafe doesn't return rows.
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info(${tableName})`
    );
    return rows.some(r => r.name === columnName);
  } catch {
    // If PRAGMA fails (table doesn't exist yet, etc.), assume column doesn't exist
    return false;
  }
}

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
        // Create tables in parallel groups (group by dependencies)
        // Group 1: Tables with no FK dependencies (can run in parallel)
        const group1 = CREATE_TABLES_SQL.filter(sql => {
          const upper = sql.toUpperCase();
          return upper.includes('CREATE TABLE') && !upper.includes('FOREIGN KEY');
        });
        // Group 2: CREATE INDEX + ALTER TABLE (depends on tables existing)
        const indexes = CREATE_TABLES_SQL.filter(sql => sql.toUpperCase().includes('CREATE INDEX'));
        // Group 3: Tables with FK dependencies
        const withFk = CREATE_TABLES_SQL.filter(sql => {
          const upper = sql.toUpperCase();
          return upper.includes('CREATE TABLE') && upper.includes('FOREIGN KEY');
        });

        // Phase 1: Create standalone tables in parallel (batches of 5)
        for (let i = 0; i < group1.length; i += 5) {
          await Promise.all(group1.slice(i, i + 5).map(sql => db.$executeRawUnsafe(sql).catch(() => {})));
        }

        // Phase 2: Create tables with FK dependencies in parallel
        for (let i = 0; i < withFk.length; i += 5) {
          await Promise.all(withFk.slice(i, i + 5).map(sql => db.$executeRawUnsafe(sql).catch(() => {})));
        }

        // Phase 3: Create indexes in parallel (batches of 10)
        for (let i = 0; i < indexes.length; i += 10) {
          await Promise.all(indexes.slice(i, i + 10).map(sql => db.$executeRawUnsafe(sql).catch(() => {})));
        }

        // Phase 4: Add new columns — check existence first to avoid "duplicate column name" errors.
        // SQLite has no `ALTER TABLE ADD COLUMN IF NOT EXISTS`, so we use PRAGMA table_info
        // to check before attempting ALTER. This keeps the dev log clean (no spurious errors).
        for (const { table, column, sql } of ALTER_TABLES_SQL) {
          const exists = await columnExists(table, column);
          if (!exists) {
            try {
              await db.$executeRawUnsafe(sql);
              console.log(`[db-init] ➕ Added column ${table}.${column}`);
            } catch (err) {
              // Race condition: another process added it between check and ALTER — safe to ignore
              console.warn(`[db-init] ⚠️ Could not add ${table}.${column}:`, err instanceof Error ? err.message : 'unknown');
            }
          }
        }

        // Initialize default passwords if not set
        try {
          await Promise.all([
            db.$executeRawUnsafe(
              `INSERT OR IGNORE INTO AppSetting (key, value, updatedAt) VALUES ('password_admin', 'sipbd2024', CURRENT_TIMESTAMP)`
            ),
            db.$executeRawUnsafe(
              `INSERT OR IGNORE INTO AppSetting (key, value, updatedAt) VALUES ('password_export', 'sipbd2024', CURRENT_TIMESTAMP)`
            ),
          ]);
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
