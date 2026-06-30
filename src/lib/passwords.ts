import { db } from '@/lib/db';
import { IMPORT_PASSWORD, EXPORT_PASSWORD } from '@/lib/constants';
import { ensureTablesExist } from '@/lib/db-init';

// Warn if passwords are not set in environment variables
if (!IMPORT_PASSWORD) {
  console.warn('⚠️ ADMIN_PASSWORD environment variable is not set!');
}
if (!EXPORT_PASSWORD) {
  console.warn('⚠️ EXPORT_PASSWORD environment variable is not set!');
}

// Default password used when no password is found anywhere
const DEFAULT_PASSWORD = 'sipbd2024';

// Cache passwords in memory for 60 seconds to avoid DB hit on every request
let passwordCache: { admin: string; exportPwd: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Get passwords from database (AppSetting) with fallback chain:
 * 1. Database (Turso) AppSetting table
 * 2. Environment variables (ADMIN_PASSWORD / EXPORT_PASSWORD)
 * 3. Default password ('sipbd2024')
 *
 * Keys in DB:
 *   - "password_admin"  → admin/import password
 *   - "password_export" → Excel export password
 */
export async function getPasswords(): Promise<{ admin: string; exportPwd: string }> {
  // Return cached if fresh
  if (passwordCache && Date.now() - passwordCache.fetchedAt < CACHE_TTL) {
    return { admin: passwordCache.admin, exportPwd: passwordCache.exportPwd };
  }

  try {
    // Ensure AppSetting table exists before querying
    await ensureTablesExist();

    // [H-4] Single findMany instead of two findUnique calls (2 round-trips → 1).
    // Behavior preserved: same fallback chain (DB → env var → DEFAULT_PASSWORD),
    // same `replace(/^"|"$/g, '')` unquoting of DB-stored JSON-encoded values.
    const settings = await db.appSetting.findMany({
      where: { key: { in: ['password_admin', 'password_export'] } },
    });
    const adminSetting = settings.find(s => s.key === 'password_admin');
    const exportSetting = settings.find(s => s.key === 'password_export');

    const admin = adminSetting?.value?.replace(/^"|"$/g, '') || IMPORT_PASSWORD || DEFAULT_PASSWORD;
    const exportPwd = exportSetting?.value?.replace(/^"|"$/g, '') || EXPORT_PASSWORD || DEFAULT_PASSWORD;

    passwordCache = { admin, exportPwd, fetchedAt: Date.now() };

    return { admin, exportPwd };
  } catch (err) {
    console.error('[passwords] Failed to read from DB:', err);
    // Fallback chain: env var → default password
    return {
      admin: IMPORT_PASSWORD || DEFAULT_PASSWORD,
      exportPwd: EXPORT_PASSWORD || DEFAULT_PASSWORD
    };
  }
}

/**
 * Verify a password against a specific type.
 * @param password - The password to verify
 * @param type - "admin" or "export"
 */
export async function verifyPassword(password: string, type: 'admin' | 'export'): Promise<boolean> {
  const passwords = await getPasswords();
  if (type === 'admin') return password === passwords.admin;
  if (type === 'export') return password === passwords.exportPwd;
  return false;
}

/**
 * Verify a password against BOTH admin and export passwords.
 * Used for legacy endpoints that accept either password.
 */
export async function verifyAnyPassword(password: string): Promise<{ valid: boolean; type: 'admin' | 'export' | null }> {
  const passwords = await getPasswords();
  if (password === passwords.admin) return { valid: true, type: 'admin' };
  if (password === passwords.exportPwd) return { valid: true, type: 'export' };
  return { valid: false, type: null };
}

/**
 * Change a password in the database. Requires the current admin password to authorize.
 */
export async function changePassword(
  currentAdminPassword: string,
  type: 'admin' | 'export',
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // Verify admin password first
  const passwords = await getPasswords();
  if (currentAdminPassword !== passwords.admin) {
    return { success: false, error: 'Password admin saat ini salah' };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: 'Password baru minimal 4 karakter' };
  }

  const key = type === 'admin' ? 'password_admin' : 'password_export';

  await db.appSetting.upsert({
    where: { key },
    update: { value: newPassword.trim() },
    create: { key, value: newPassword.trim() },
  });

  // Invalidate cache
  passwordCache = null;

  return { success: true };
}

// Invalidate cache (call after password changes)
export function invalidatePasswordCache() {
  passwordCache = null;
}
