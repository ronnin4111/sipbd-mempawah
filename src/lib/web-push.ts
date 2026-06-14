/**
 * Web Push Notification utility using VAPID keys.
 *
 * VAPID keys are loaded from environment variables. If they don't exist,
 * new keys are generated on first run and logged to the console.
 */

import webpush from 'web-push';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:sipbd@mempawah.go.id';
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

// Generate VAPID keys if not configured
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn(
    '[web-push] ⚠️ VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set in environment. ' +
    'Generating new keys... Please add them to your .env file.'
  );
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = keys.publicKey;
  VAPID_PRIVATE_KEY = keys.privateKey;
  console.log('[web-push] Generated VAPID_PUBLIC_KEY:', VAPID_PUBLIC_KEY);
  console.log('[web-push] Generated VAPID_PRIVATE_KEY:', VAPID_PRIVATE_KEY);
}

// Configure web-push with VAPID details
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/**
 * Get the VAPID public key (safe to expose to the frontend).
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Get both VAPID keys (only for server-side use).
 */
export function getVapidKeys(): { publicKey: string; privateKey: string } {
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
}

/**
 * Send a push notification to a specific subscription.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<void> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error: unknown) {
    // If the subscription is no longer valid (410 Gone), we should handle it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const wpError = error as { statusCode: number; body?: string };
      if (wpError.statusCode === 410) {
        console.log('[web-push] Subscription expired (410 Gone), should be removed:', subscription.endpoint);
        throw new Error('SUBSCRIPTION_EXPIRED');
      }
    }
    console.error('[web-push] Failed to send notification:', error);
    throw error;
  }
}
