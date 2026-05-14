import { db } from '@/lib/db';
import { IMPORT_PASSWORD, EXPORT_PASSWORD } from '@/lib/constants';

// Cache passwords in memory for 60 seconds to avoid DB hit on every request
let passwordCache: { admin: string; exportPwd: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Get passwords from database (AppSetting) with fallback to hardcoded constants.
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
    const [adminSetting, exportSetting] = await Promise.all([
      db.appSetting.findUnique({ where: { key: 'password_admin' } }),
      db.appSetting.findUnique({ where: { key: 'password_export' } }),
    ]);

    const admin = adminSetting?.value?.replace(/^"|"$/g, '') || IMPORT_PASSWORD;
    const exportPwd = exportSetting?.value?.replace(/^"|"$/g, '') || EXPORT_PASSWORD;

    passwordCache = { admin, exportPwd, fetchedAt: Date.now() };

    return { admin, exportPwd };
  } catch {
    // Fallback to hardcoded if DB is unavailable
    return { admin: IMPORT_PASSWORD, exportPwd: EXPORT_PASSWORD };
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
