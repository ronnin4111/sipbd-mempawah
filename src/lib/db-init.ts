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
];

const ALTER_TABLES_SQL = [
  // Add fotoUrl and noWa columns if they don't exist (for existing Turso tables)
  `ALTER TABLE Penyuluh ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Penyuluh ADD COLUMN noWa TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Pegawai ADD COLUMN fotoUrl TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE Pegawai ADD COLUMN noWa TEXT NOT NULL DEFAULT ''`,
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
