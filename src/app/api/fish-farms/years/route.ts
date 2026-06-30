import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureTablesExist();
    const result = await db.fishFarm.findMany({
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'asc' },
    });
    const years = result.map((r) => r.year);
    return NextResponse.json({ years });
  } catch (error) {
    console.error('Error fetching years:', error);
    return NextResponse.json({ error: 'Failed to fetch years' }, { status: 500 });
  }
}
