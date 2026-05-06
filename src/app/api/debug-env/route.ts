import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    VERCEL: process.env.VERCEL || 'not set',
    DATABASE_URL: process.env.DATABASE_URL ? 'set (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'not set',
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? 'set' : 'not set',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  });
}
