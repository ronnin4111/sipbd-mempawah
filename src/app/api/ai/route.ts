import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'SIPBD AI Chat',
    version: '1.0',
  });
}
