import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';
import { verifyPassword } from '@/lib/passwords';

// GET — get all social media account links
export async function GET() {
  try {
    await ensureTablesExist();
    const setting = await db.appSetting.findUnique({ where: { key: 'social_media_accounts' } });
    const accounts = setting ? JSON.parse(setting.value) : [];
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[social-media/accounts] GET error:', error);
    return NextResponse.json({ accounts: [] });
  }
}

// POST — save social media account links (admin only)
export async function POST(req: NextRequest) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const { accounts, adminPassword } = body;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Password admin diperlukan' }, { status: 401 });
    }
    const isValid = await verifyPassword(adminPassword, 'admin');
    if (!isValid) {
      return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
    }

    if (!Array.isArray(accounts)) {
      return NextResponse.json({ error: 'Format data tidak valid' }, { status: 400 });
    }

    await db.appSetting.upsert({
      where: { key: 'social_media_accounts' },
      update: { value: JSON.stringify(accounts) },
      create: { key: 'social_media_accounts', value: JSON.stringify(accounts) },
    });

    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    console.error('[social-media/accounts] POST error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan akun media sosial' }, { status: 500 });
  }
}
