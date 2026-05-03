import { NextRequest, NextResponse } from 'next/server';
import { IMPORT_PASSWORD } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    const valid = password === IMPORT_PASSWORD;

    return NextResponse.json({ valid });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json(
      { valid: false },
      { status: 500 }
    );
  }
}
