import { NextResponse } from 'next/server';
import { ensureTablesExist, tableExists } from '@/lib/db-init';

// GET /api/init-db - Initialize database tables
// This endpoint ensures all required tables exist in the database.
// Safe to call multiple times.
export async function GET() {
  try {
    await ensureTablesExist();

    // Check which tables exist
    const penyuluhOk = await tableExists('Penyuluh');
    const pegawaiOk = await tableExists('Pegawai');

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      tables: {
        Penyuluh: penyuluhOk,
        Pegawai: pegawaiOk,
      },
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to initialize database',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
