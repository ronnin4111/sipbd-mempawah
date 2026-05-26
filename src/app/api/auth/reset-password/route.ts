import { NextRequest, NextResponse } from 'next/server';
import { ensureTablesExist } from '@/lib/db-init';
import { db } from '@/lib/db';

// Secret key for password reset - set RESET_SECRET in Vercel env vars
// This prevents unauthorized password resets
const RESET_SECRET = process.env.RESET_SECRET || 'sipbd-reset-2024';

export async function POST(request: NextRequest) {
  await ensureTablesExist();

  try {
    const body = await request.json();
    const { secret, newPassword, type } = body as {
      secret: string;
      newPassword?: string;
      type?: 'admin' | 'export';
    };

    // Verify secret key
    if (secret !== RESET_SECRET) {
      return NextResponse.json(
        { error: 'Secret key tidak valid' },
        { status: 401 }
      );
    }

    // If no type specified, reset both
    const types: ('admin' | 'export')[] = type ? [type] : ['admin', 'export'];
    const password = newPassword && newPassword.trim().length >= 4
      ? newPassword.trim()
      : 'sipbd2024'; // default reset password

    for (const t of types) {
      const key = t === 'admin' ? 'password_admin' : 'password_export';
      await db.appSetting.upsert({
        where: { key },
        update: { value: password },
        create: { key, value: password },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Password ${types.map(t => t === 'admin' ? 'Admin' : 'Export').join(' & ')} berhasil direset`,
      newPassword: password,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Gagal mereset password' },
      { status: 500 }
    );
  }
}
