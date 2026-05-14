import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';

// GET /api/settings?key=columnVisibility — get a setting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const setting = await db.appSetting.findUnique({ where: { key } });
    return NextResponse.json({ value: setting?.value ?? null });
  } catch (error) {
    console.error('Error fetching setting:', error);
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
  }
}

// PUT /api/settings — save a setting (requires admin password)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    // Verify admin password
    if (!password) {
      return NextResponse.json({ error: 'Password diperlukan' }, { status: 401 });
    }

    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 403 });
    }

    // Upsert the setting
    const setting = await db.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });

    return NextResponse.json({ value: setting.value });
  } catch (error) {
    console.error('Error saving setting:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}
