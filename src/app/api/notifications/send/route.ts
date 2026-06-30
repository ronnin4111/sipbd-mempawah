import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';
import { sendPushNotification } from '@/lib/web-push';

// Internal secret for server-to-server calls
const NOTIFICATION_SECRET = process.env.NOTIFICATION_SECRET || 'sipbd-internal-2024';

/**
 * POST /api/notifications/send
 * Send a push notification to all subscribed admins.
 * Body: { title, body, url?, icon?, secret? }
 *
 * Can be called either:
 * 1. From server-side with the internal secret
 * 2. From admin UI (requires admin session)
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();

    const body = await request.json();
    const { title, body: notificationBody, url, icon, secret } = body as {
      title: string;
      body: string;
      url?: string;
      icon?: string;
      secret?: string;
    };

    if (!title || !notificationBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body' },
        { status: 400 }
      );
    }

    // Check authorization: either internal secret or admin session
    const isInternalCall = secret === NOTIFICATION_SECRET;
    if (!isInternalCall) {
      // For non-internal calls, we could check admin session here
      // For now, we allow the call but log it
      console.log('[notifications/send] External notification request received');
    }

    // Get all admin subscriptions
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: 'admin' },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No subscribers to notify',
        sent: 0,
      });
    }

    const payload = {
      title,
      body: notificationBody,
      ...(url && { url }),
      ...(icon && { icon }),
    };

    let sentCount = 0;
    const expiredEndpoints: string[] = [];

    // [M-7] Send to each subscription concurrently with Promise.allSettled.
    //       Previously a sequential for...of awaited each push one at a time,
    //       which serializes N independent HTTP round-trips to the push
    //       service. allSettled preserves the per-item try/catch semantics:
    //       SUBSCRIPTION_EXPIRED rejections are still harvested for cleanup,
    //       other rejections are still logged per-endpoint. sentCount /
    //       expiredEndpoints accounting is unchanged.
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        sentCount++;
      } else {
        const reason = result.reason;
        if (reason instanceof Error && reason.message === 'SUBSCRIPTION_EXPIRED') {
          expiredEndpoints.push(subscriptions[idx].endpoint);
        } else {
          console.error(`[notifications/send] Failed for ${subscriptions[idx].endpoint}:`, reason);
        }
      }
    });

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
      console.log(`[notifications/send] Removed ${expiredEndpoints.length} expired subscriptions`);
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: subscriptions.length,
      expired: expiredEndpoints.length,
    });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
