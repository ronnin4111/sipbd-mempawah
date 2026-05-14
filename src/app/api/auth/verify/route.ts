import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, verifyAnyPassword } from '@/lib/passwords';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, type } = body as { password: string; type?: 'admin' | 'export' };

    if (!password) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // If type is specified, verify against that specific password
    if (type === 'admin' || type === 'export') {
      const valid = await verifyPassword(password, type);
      return NextResponse.json({ valid, type });
    }

    // Default: verify against admin password (backward compatible)
    // Also check export password and return which type matched
    const result = await verifyAnyPassword(password);
    return NextResponse.json({ valid: result.valid, type: result.type });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json(
      { valid: false },
      { status: 500 }
    );
  }
}
