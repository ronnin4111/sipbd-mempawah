import ZAI from 'z-ai-web-dev-sdk';

/**
 * Initialize ZAI SDK with configuration.
 *
 * Strategy:
 * 1. Try ZAI.create() first (reads from .z-ai-config file on local dev)
 * 2. If that fails, try instantiating with environment variables
 * 3. If no config at all, return null (AI features will be disabled gracefully)
 *
 * For Vercel deployment:
 * - Set ZAI_BASE_URL, ZAI_API_KEY (and optionally ZAI_CHAT_ID, ZAI_USER_ID, ZAI_TOKEN)
 *   as environment variables in Vercel dashboard
 * - The ZAI API must be accessible from Vercel's servers
 */

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let zaiInstance: InstanceType<typeof ZAI> | null = null;
let initError: string | null = null;

export async function getZAI(): Promise<InstanceType<typeof ZAI> | null> {
  if (zaiInstance) return zaiInstance;
  if (initError) {
    // Already tried and failed - don't keep retrying
    console.warn('ZAI SDK previously failed to init:', initError);
    return null;
  }

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
      initError = `Failed to init ZAI from env vars: ${err instanceof Error ? err.message : String(err)}`;
      console.error(initError);
      return null;
    }
  }

  initError = 'No ZAI configuration available (neither config file nor env vars)';
  console.warn(initError);
  return null;
}

/**
 * Check if ZAI is available (for health checks)
 */
export async function isZAIAvailable(): Promise<boolean> {
  const zai = await getZAI();
  return zai !== null;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetZAI(): void {
  zaiInstance = null;
  initError = null;
}
