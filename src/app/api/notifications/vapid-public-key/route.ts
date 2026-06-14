import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/web-push';

/**
 * GET /api/notifications/vapid-public-key
 * Returns the VAPID public key for the frontend to use for push subscription.
 */
export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      return NextResponse.json(
        { error: 'VAPID public key not configured' },
        { status: 500 }
      );
    }
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    return NextResponse.json(
      { error: 'Failed to get VAPID public key' },
      { status: 500 }
    );
  }
}
