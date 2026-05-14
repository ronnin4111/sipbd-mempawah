import { NextRequest, NextResponse } from 'next/server';
import { changePassword } from '@/lib/passwords';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, type, newPassword } = body as {
      currentPassword: string;
      type: 'admin' | 'export';
      newPassword: string;
    };

    if (!currentPassword || !type || !newPassword) {
      return NextResponse.json(
        { error: 'currentPassword, type, dan newPassword wajib diisi' },
        { status: 400 }
      );
    }

    if (type !== 'admin' && type !== 'export') {
      return NextResponse.json(
        { error: 'type harus "admin" atau "export"' },
        { status: 400 }
      );
    }

    const result = await changePassword(currentPassword, type, newPassword);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: `Password ${type === 'admin' ? 'admin' : 'export'} berhasil diubah` });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah password' },
      { status: 500 }
    );
  }
}
