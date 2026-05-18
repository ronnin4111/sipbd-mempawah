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
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS Pegawai_nama_idx ON Pegawai(nama)`,
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
        for (const sql of CREATE_TABLES_SQL) {
          await db.$executeRawUnsafe(sql);
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
