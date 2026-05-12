import ZAI from 'z-ai-web-dev-sdk';

/**
 * Initialize ZAI SDK with configuration.
 *
 * Strategy:
 * 1. Try ZAI.create() first (reads from .z-ai-config file on local dev)
 * 2. If that fails, try instantiating with environment variables
 * 3. If no config at all, return null (AI features will use /api/ai/zai-proxy as fallback)
 *
 * For Vercel deployment:
 * - Set these environment variables in Vercel dashboard:
 *   ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_USER_ID, ZAI_TOKEN
 */

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let zaiInstance: InstanceType<typeof ZAI> | null = null;
let initAttempted = false;

export async function getZAI(): Promise<InstanceType<typeof ZAI> | null> {
  if (zaiInstance) return zaiInstance;
  if (initAttempted) return null; // Already tried, don't retry

  initAttempted = true;

  // Strategy 1: Try the default method (reads from .z-ai-config file)
  try {
    zaiInstance = await ZAI.create();
    console.log('ZAI SDK initialized from config file');
    return zaiInstance;
  } catch (fileError) {
    console.log('ZAI config file not found, trying environment variables...');
  }

  // Strategy 2: Construct config from environment variables
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (baseUrl && apiKey) {
    try {
      const config: ZAIConfig = {
        baseUrl,
        apiKey,
        chatId: process.env.ZAI_CHAT_ID,
        userId: process.env.ZAI_USER_ID,
        token: process.env.ZAI_TOKEN,
      };
      zaiInstance = new ZAI(config);
      console.log('ZAI SDK initialized from environment variables');
      return zaiInstance;
    } catch (err) {
      console.error('Failed to init ZAI from env vars:', err);
      return null;
    }
  }

  console.warn('No ZAI configuration available (neither config file nor env vars). AI features will use proxy fallback.');
  return null;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetZAI(): void {
  zaiInstance = null;
  initAttempted = false;
}
