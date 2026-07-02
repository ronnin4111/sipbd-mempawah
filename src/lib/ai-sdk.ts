import { geminiChatCompletion, isGeminiConfigured, isGeminiConfiguredAsync, getGeminiModel } from './gemini-ai';
import { groqChatCompletion, isGroqConfigured, isGroqConfiguredAsync, getGroqModel } from './groq-ai';
import { naraChatCompletion, isNaraConfigured, isNaraConfiguredAsync, getNaraModel } from './nara-router';
import { db } from './db';

/**
 * Unified AI SDK helper — Multi-provider with automatic fallback.
 *
 * Strategy (UPDATED — NaraRouter added as priority 2):
 * 1. Z.AI API (primary — always available in sandbox/dev, no API key needed)
 *    - Uses z-ai-web-dev-sdk with auto-discovered config
 *    - Models: glm-4-plus, glm-4-flash, etc. (auto-selected by Z.AI)
 *    - No rate limits for sandbox/dev usage
 *    - No API key configuration needed!
 * 2. NaraRouter API (fallback 1 — OpenAI-compatible Indonesian gateway)
 *    - Free tier: 7M tokens/day, 10 RPM
 *    - Models: mistral-large (default), mistral-medium-3-5, claude-sonnet-4.5, claude-haiku-4.5
 *    - Get key at https://router.bynara.id (starts with sk-nry-)
 * 3. Google Gemini API (fallback 2 — if API key configured)
 *    - Free: 15 RPM, 1500 RPD for gemini-2.0-flash (default)
 *    - Fallback models: gemini-2.5-flash-preview, gemini-1.5-flash
 * 4. Groq API (fallback 3 — if API key configured)
 *    - Free: 30 RPM, 6000 RPD for llama-3.3-70b-versatile (default)
 *    - Fallback models: llama-3.1-8b-instant, mixtral-8x7b-32768
 *
 * API Key Resolution (no env var mutation!):
 * - Reads key from DB (AppSetting) and passes directly to AI client constructors
 * - Also checks environment variables as fallback
 * - This approach works correctly in Vercel's serverless environment
 */

export interface UnifiedAIOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Options for Vision AI (VLM) — AI can "see" images.
 * Uses Z.AI's createVision API (glm-4v model).
 */
export interface VisionAIOptions {
  /** System prompt — same role as in text mode (peran, aturan, data context) */
  systemPrompt: string;
  /** User's text question */
  userText: string;
  /** Image data URL — e.g. "data:image/jpeg;base64,..." or "data:image/png;base64,..." */
  imageDataUrl: string;
  /** Optional conversation history */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
}

export interface UnifiedAIResult {
  success: boolean;
  content: string;
  error?: string;
  provider?: string;
  model?: string;
}

/**
 * Get API key from environment variable or database setting.
 * Env vars take priority over database settings.
 * Logs DB errors for debugging (instead of silently ignoring).
 */
async function getApiKey(envVarName: string, dbSettingKey: string): Promise<string | null> {
  // 1. Check environment variable first (always fresh, no caching issues)
  const envKey = process.env[envVarName];
  if (envKey) {
    console.log(`[AI SDK] ${envVarName} found in env var`);
    return envKey;
  }

  // 2. Check database setting (fresh query each call — no stale cache)
  try {
    const setting = await db.appSetting.findUnique({ where: { key: dbSettingKey } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed === 'string' && parsed.trim()) {
        console.log(`[AI SDK] ${envVarName} found in database (key=${dbSettingKey}), updated=${setting.updatedAt?.toISOString()}`);
        return parsed.trim();
      }
      console.warn(`[AI SDK] ${envVarName} in database is empty or invalid (key=${dbSettingKey})`);
    } else {
      console.log(`[AI SDK] ${envVarName} not found in database (key=${dbSettingKey})`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown DB error';
    const errStack = err instanceof Error ? err.stack : '';
    console.error(`[AI SDK] DB error reading ${dbSettingKey}:`, errMsg);
    console.error(`[AI SDK] Stack:`, errStack?.substring(0, 500));
  }

  return null;
}

/**
 * Get model from environment variable or database setting.
 */
async function getModel(envVarName: string, dbSettingKey: string): Promise<string | null> {
  const envModel = process.env[envVarName];
  if (envModel) return envModel;

  try {
    const setting = await db.appSetting.findUnique({ where: { key: dbSettingKey } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
    }
  } catch {
    // Ignore DB errors for model setting (not critical)
  }

  return null;
}

/**
 * Get Z.AI config from environment variables.
 * Returns config object if env vars are set, null otherwise.
 *
 * Environment variables (for Vercel / production deployment):
 * - ZAI_BASE_URL: API base URL (e.g., https://api.z.ai/api/v1)
 * - ZAI_API_KEY: API key for authentication
 * - ZAI_CHAT_ID: (optional) Chat session ID
 * - ZAI_USER_ID: (optional) User ID
 * - ZAI_TOKEN: (optional) JWT token
 */
function getZaiConfigFromEnv(): { baseUrl: string; apiKey: string; chatId?: string; userId?: string; token?: string } | null {
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  if (baseUrl && apiKey) {
    console.log('[AI SDK] Z.AI config found in env vars (ZAI_BASE_URL)');
    return {
      baseUrl,
      apiKey,
      ...(process.env.ZAI_CHAT_ID ? { chatId: process.env.ZAI_CHAT_ID } : {}),
      ...(process.env.ZAI_USER_ID ? { userId: process.env.ZAI_USER_ID } : {}),
      ...(process.env.ZAI_TOKEN ? { token: process.env.ZAI_TOKEN } : {}),
    };
  }
  return null;
}

/**
 * Try to load Z.AI config from file system.
 * Returns config object if found, null otherwise.
 */
async function getZaiConfigFromFile(): Promise<{ baseUrl: string; apiKey: string; chatId?: string; userId?: string; token?: string } | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const configPaths = [
      path.join(process.cwd(), '.z-ai-config'),
      path.join(os.homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];

    for (const configPath of configPaths) {
      try {
        const configStr = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configStr);
        if (config.baseUrl && config.apiKey) {
          console.log('[AI SDK] Z.AI config loaded from file:', configPath);
          return config;
        }
      } catch {
        // Continue to next path
      }
    }
  } catch {
    // fs import failed (Vercel edge runtime)
  }
  return null;
}

/**
 * Get Z.AI config from any available source.
 * Priority: 1. Environment variables → 2. File system → 3. SDK auto-discovery
 * Note: SDK auto-discovery is handled in callZAI() directly (instance-based).
 */
async function getZaiConfig(): Promise<{ baseUrl: string; apiKey: string; chatId?: string; userId?: string; token?: string } | null> {
  // 1. Check environment variables FIRST (works on Vercel)
  const envConfig = getZaiConfigFromEnv();
  if (envConfig) return envConfig;

  // 2. Manual file system config reading (works in sandbox with .z-ai-config)
  const fileConfig = await getZaiConfigFromFile();
  if (fileConfig) return fileConfig;

  // 3. SDK auto-discovery is handled separately in callZAI() / checkZaiAvailable()
  return null;
}

/**
 * Check if Z.AI is available by trying to load config.
 * Returns true if Z.AI can be initialized, false otherwise.
 */
export async function checkZaiAvailable(): Promise<boolean> {
  const config = await getZaiConfig();
  if (config) {
    console.log('[AI SDK] Z.AI available: baseUrl=' + config.baseUrl.substring(0, 30) + '...');
    return true;
  }
  // Also check if SDK auto-discovery works (no env vars or file needed)
  try {
    await getZai();
    console.log('[AI SDK] Z.AI available via SDK auto-discovery');
    return true;
  } catch {
    // SDK can't find config
  }
  console.log('[AI SDK] Z.AI NOT available — no config found (env vars or file)');
  return false;
}

// [H-2] Module-scope memoization of the Z.AI SDK instance.
// Previously `callZAI` re-created the instance on every invocation
// (dynamic import + config resolution + `new ZAI(config)` or `ZAI.create()`).
// Now we cache the instance after the first successful init and reuse it.
// `zaiInitPromise` dedupes concurrent first-callers within the same cold start.
let zaiInstance: any = null;
let zaiInitPromise: Promise<any> | null = null;

async function getZai(): Promise<any> {
  if (zaiInstance) return zaiInstance;
  if (!zaiInitPromise) {
    zaiInitPromise = (async () => {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const config = getZaiConfigFromEnv() || await getZaiConfigFromFile();
      if (config) {
        // Use resolved config (from env vars or file)
        // Note: ZAI constructor is private in TypeScript types but accessible in JS runtime
        // This is needed because ZAI.create() only reads from file system, not env vars
        const ZAIConstructor = ZAI as any;
        const inst = new ZAIConstructor(config);
        console.log(`[AI SDK] Z.AI initialized with config: baseUrl=${config.baseUrl.substring(0, 30)}...`);
        return inst;
      }
      // Try SDK auto-discovery as last resort
      try {
        const inst = await ZAI.create();
        console.log('[AI SDK] Z.AI initialized via SDK auto-discovery');
        return inst;
      } catch (sdkError) {
        const errMsg = sdkError instanceof Error ? sdkError.message : 'Unknown';
        let hint = '';
        if (errMsg.includes('Configuration file not found') || errMsg.includes('config')) {
          hint = ' Set ZAI_BASE_URL=https://api.z.ai/api/v1 and ZAI_API_KEY in env vars. (NOT chat.z.ai/api/v1 — that is the web frontend!)';
        }
        throw new Error(`Z.AI config not found: ${errMsg.substring(0, 200)}.${hint}`);
      }
    })();
  }
  try {
    zaiInstance = await zaiInitPromise;
    return zaiInstance;
  } catch (err) {
    // Reset so the next call can retry (don't cache failure forever)
    zaiInitPromise = null;
    throw err;
  }
}

/**
 * Try calling z-ai-web-dev-sdk as a provider.
 * Config resolution priority:
 * 1. Environment variables (ZAI_BASE_URL, ZAI_API_KEY) — works on Vercel
 * 2. SDK auto-discovery (ZAI.create()) — works in sandbox with .z-ai-config
 * 3. Manual file reading — fallback when SDK fails but config file exists
 */
async function callZAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  try {
    // [H-2] Reuse the memoized Z.AI instance (was: re-created per call)
    const zai = await getZai();

    // z-ai uses 'assistant' role for system prompts
    const messages = options.messages.map(m => ({
      role: m.role === 'system' ? ('assistant' as const) : (m.role as 'user' | 'assistant'),
      content: m.content,
    }));

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    // Check for API-level error responses (e.g., Authentication Failed)
    // Z.AI public API may return HTTP 200 with {"code": 1000, "msg": "Authentication Failed", "success": false}
    if (completion && typeof completion === 'object' && !completion.choices) {
      const apiError = completion as Record<string, unknown>;
      const code = apiError.code;
      const msg = apiError.msg || apiError.message || '';
      if (code || apiError.success === false) {
        const errorDetail = `Z.AI API error (code=${code}): ${msg}`;
        console.warn('[AI SDK] Z.AI API returned error:', errorDetail);
        return {
          success: false,
          content: '',
          error: code === 1000
            ? `Z.AI API key tidak valid (Authentication Failed). Untuk production, gunakan API key dari https://chat.z.ai → Settings → API Keys. Sandbox key "Z.ai" hanya berlaku di environment sandbox.`
            : errorDetail,
          provider: 'z-ai',
        };
      }
    }

    const content = completion.choices?.[0]?.message?.content || '';

    // If content is empty, treat as failure so fallback chain kicks in
    if (!content || !content.trim()) {
      console.warn('[AI SDK] Z.AI returned empty content — treating as failure for fallback');
      return {
        success: false,
        content: '',
        error: 'Z.AI mengembalikan respons kosong. Fallback ke provider lain.',
        provider: 'z-ai',
      };
    }

    return {
      success: true,
      content,
      provider: 'z-ai',
      model: completion.model || 'z-ai',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[AI SDK] z-ai error:', message);
    // Provide helpful error for common issues
    let helpfulError = message;
    if (message.includes('status 404')) {
      helpfulError = `Z.AI API URL tidak valid (404 Not Found). Pastikan ZAI_BASE_URL menggunakan https://api.z.ai/api/v1 BUKAN https://chat.z.ai/api/v1. Detail: ${message}`;
    } else if (message.includes('Authentication Failed') || message.includes('1000')) {
      helpfulError = `Z.AI API key tidak valid. Dapatkan API key dari https://chat.z.ai → Settings. Detail: ${message}`;
    } else if (message.includes('token expired')) {
      helpfulError = `Z.AI token sudah expired. Perbarui ZAI_TOKEN di environment variables. Detail: ${message}`;
    }
    return {
      success: false,
      content: '',
      error: helpfulError,
      provider: 'z-ai',
    };
  }
}

/**
 * Timeout wrapper — ensures AI calls don't hang forever.
 * Default 30s timeout (Vercel serverless max is 60s for hobby tier).
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 30000,
  label: string = 'AI'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Call AI using the best available provider with automatic fallback.
 *
 * NEW PRIORITY (Z.AI as primary):
 * 1. Z.AI API (always available in sandbox/dev — no API key needed!)
 * 2. Google Gemini API (if API key configured via env or DB)
 * 3. Groq API (if API key configured via env or DB)
 *
 * Why Z.AI first?
 * - No API key configuration needed — works out of the box
 * - Reliable in sandbox/dev environments
 * - Good model quality (GLM-4-Plus)
 * - No rate limits for development usage
 * - Gemini/Groq still available as fallbacks if user configures API keys
 */
export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  const errors: Array<{ provider: string; detail: string }> = [];
  const startTime = Date.now();

  // Resolve API keys + models in a SINGLE DB round-trip (4 → 1 query).
  // [H-1] Previously 4 sequential `findUnique` calls via getApiKey/getModel.
  // Behavior preserved: env var takes priority; DB value must JSON-parse to a
  // non-empty trimmed string; otherwise null.
  console.log('[AI SDK] Resolving API keys...');
  const settings = await db.appSetting.findMany({
    where: { key: { in: ['ai_nara_router_api_key', 'ai_gemini_api_key', 'ai_groq_api_key', 'ai_nara_router_model', 'ai_gemini_model', 'ai_groq_model'] } },
  });
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  const parseSetting = (k: string): string | null => {
    const v = settingsMap.get(k);
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
      return null;
    } catch {
      return null;
    }
  };
  const naraKey = process.env.NARA_ROUTER_API_KEY || parseSetting('ai_nara_router_api_key');
  const geminiKey = process.env.GEMINI_API_KEY || parseSetting('ai_gemini_api_key');
  const groqKey = process.env.GROQ_API_KEY || parseSetting('ai_groq_api_key');
  const naraModel = process.env.NARA_ROUTER_MODEL || parseSetting('ai_nara_router_model');
  const geminiModel = process.env.GEMINI_MODEL || parseSetting('ai_gemini_model');
  const groqModel = process.env.GROQ_MODEL || parseSetting('ai_groq_model');

  console.log(`[AI SDK] Keys resolved: NaraRouter=${naraKey ? 'yes(' + naraKey.substring(0, 8) + '...)' : 'no'}, Gemini=${geminiKey ? 'yes(' + geminiKey.substring(0, 6) + '...)' : 'no'}, Groq=${groqKey ? 'yes(' + groqKey.substring(0, 6) + '...)' : 'no'}`);
  console.log(`[AI SDK] Models resolved: NaraRouter=${naraModel || 'default'}, Gemini=${geminiModel || 'default'}, Groq=${groqModel || 'default'}`);

  // ============================================================
  // 1. Try Z.AI first — always available in sandbox/dev!
  // No API key needed, works out of the box.
  // ============================================================
  console.log('[AI SDK] Trying Z.AI (primary)...');
  const zaiResult = await withTimeout(callZAI(options), 60000, 'Z.AI');
  if (zaiResult.success) {
    const elapsed = Date.now() - startTime;
    console.log(`[AI SDK] Z.AI SUCCESS in ${elapsed}ms, model=${zaiResult.model}`);
    return zaiResult;
  }
  errors.push({ provider: 'z-ai', detail: zaiResult.error || 'Not available' });
  console.warn('[AI SDK] Z.AI failed:', (zaiResult.error || '').substring(0, 200));

  // ============================================================
  // 2. Try NaraRouter as fallback 1 — OpenAI-compatible Indonesian gateway
  // Free tier: 7M tokens/day, 10 RPM, access to Mistral Large + Claude.
  // ============================================================
  if (naraKey) {
    console.log('[AI SDK] Trying NaraRouter (fallback 1)...');
    try {
      const naraStart = Date.now();
      const result = await withTimeout(
        naraChatCompletion({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          apiKey: naraKey,
          model: naraModel || undefined,
        }),
        30000,
        'NaraRouter'
      );
      const naraElapsed = Date.now() - naraStart;

      if (result.success) {
        console.log(`[AI SDK] NaraRouter SUCCESS in ${naraElapsed}ms, model=${result.model}`);
        return {
          success: true,
          content: result.content,
          provider: 'nara-router',
          model: result.model || naraModel || 'mistral-large',
        };
      }

      const errDetail = result.error || 'Unknown error';
      errors.push({ provider: 'NaraRouter', detail: errDetail });
      console.warn(`[AI SDK] NaraRouter FAILED in ${naraElapsed}ms:`, errDetail.substring(0, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ provider: 'NaraRouter', detail: msg.substring(0, 300) });
      console.warn('[AI SDK] NaraRouter exception:', msg.substring(0, 200));
    }
  } else {
    console.log('[AI SDK] Skipping NaraRouter — no API key');
  }

  // Add delay before trying next provider to avoid rapid rate limit hits
  if (naraKey && geminiKey) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ============================================================
  // 3. Try Google Gemini as fallback 2 — if API key available
  // ============================================================
  if (geminiKey) {
    console.log('[AI SDK] Trying Google Gemini (fallback)...');
    try {
      const geminiStart = Date.now();
      const result = await withTimeout(
        geminiChatCompletion({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          apiKey: geminiKey,
          model: geminiModel || undefined,
        }),
        30000,
        'Gemini'
      );
      const geminiElapsed = Date.now() - geminiStart;

      if (result.success) {
        console.log(`[AI SDK] Gemini SUCCESS in ${geminiElapsed}ms, model=${result.model}`);
        return {
          success: true,
          content: result.content,
          provider: 'google-gemini',
          model: result.model || geminiModel || 'gemini-2.0-flash',
        };
      }

      const errDetail = result.error || 'Unknown error';
      errors.push({ provider: 'Gemini', detail: errDetail });
      console.warn(`[AI SDK] Gemini FAILED in ${geminiElapsed}ms:`, errDetail.substring(0, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ provider: 'Gemini', detail: msg.substring(0, 300) });
      console.warn('[AI SDK] Gemini exception:', msg.substring(0, 200));
    }
  } else {
    console.log('[AI SDK] Skipping Gemini — no API key');
  }

  // Add delay before trying next provider to avoid rapid rate limit hits
  if (geminiKey && groqKey) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ============================================================
  // 4. Try Groq as fallback 3 — if API key available
  // ============================================================
  if (groqKey) {
    console.log('[AI SDK] Trying Groq (fallback 3)...');
    try {
      const groqStart = Date.now();
      const result = await withTimeout(
        groqChatCompletion({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          apiKey: groqKey,
          model: groqModel || undefined,
        }),
        30000,
        'Groq'
      );
      const groqElapsed = Date.now() - groqStart;

      if (result.success) {
        console.log(`[AI SDK] Groq SUCCESS in ${groqElapsed}ms, model=${result.model}`);
        return {
          success: true,
          content: result.content,
          provider: 'groq',
          model: result.model || groqModel || 'llama-3.3-70b-versatile',
        };
      }

      const errDetail = result.error || 'Unknown error';
      errors.push({ provider: 'Groq', detail: errDetail });
      console.warn(`[AI SDK] Groq FAILED in ${groqElapsed}ms:`, errDetail.substring(0, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ provider: 'Groq', detail: msg.substring(0, 300) });
      console.warn('[AI SDK] Groq exception:', msg.substring(0, 200));
    }
  } else {
    console.log('[AI SDK] Skipping Groq — no API key');
  }

  // If all providers failed but at least one had a rate limit error,
  // try Z.AI again or the first available key-based provider after a delay
  const hasRateLimit = errors.some(e =>
    e.detail.includes('429') || e.detail.includes('rate') || e.detail.includes('RESOURCE_EXHAUSTED')
  );
  if (hasRateLimit) {
    console.log('[AI SDK] Rate limit detected, retrying after 3s delay...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try Z.AI first (it's independent of rate limits)
    const retryZai = await withTimeout(callZAI(options), 60000, 'Z.AI-retry');
    if (retryZai.success) {
      console.log('[AI SDK] Z.AI retry SUCCESS');
      return retryZai;
    }

    // Try NaraRouter (it's independent of Gemini/Groq rate limits)
    if (naraKey) {
      try {
        const result = await withTimeout(
          naraChatCompletion({
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            apiKey: naraKey,
            model: naraModel || undefined,
          }),
          30000,
          'NaraRouter-retry'
        );
        if (result.success) {
          console.log('[AI SDK] NaraRouter retry SUCCESS');
          return {
            success: true,
            content: result.content,
            provider: 'nara-router-retry',
            model: result.model || naraModel || 'mistral-large',
          };
        }
      } catch {
        // retry failed, continue to next provider
      }
    }

    if (geminiKey) {
      try {
        const result = await withTimeout(
          geminiChatCompletion({
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            apiKey: geminiKey,
            model: geminiModel || undefined,
          }),
          30000,
          'Gemini-retry'
        );
        if (result.success) {
          console.log('[AI SDK] Gemini retry SUCCESS');
          return {
            success: true,
            content: result.content,
            provider: 'google-gemini-retry',
            model: result.model || geminiModel || 'gemini-2.0-flash',
          };
        }
      } catch {
        // retry failed, continue to error return
      }
    }

    if (groqKey) {
      try {
        const result = await withTimeout(
          groqChatCompletion({
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            apiKey: groqKey,
            model: groqModel || undefined,
          }),
          30000,
          'Groq-retry'
        );
        if (result.success) {
          console.log('[AI SDK] Groq retry SUCCESS');
          return {
            success: true,
            content: result.content,
            provider: 'groq-retry',
            model: result.model || groqModel || 'llama-3.3-70b-versatile',
          };
        }
      } catch {
        // retry failed, continue to error return
      }
    }
  }

  const totalElapsed = Date.now() - startTime;
  console.error(`[AI SDK] ALL providers failed in ${totalElapsed}ms. Errors:`, JSON.stringify(errors));

  // All providers failed — return combined error with helpful message
  if (!naraKey && !geminiKey && !groqKey && errors.some(e => e.provider === 'z-ai')) {
    return {
      success: false,
      content: '',
      error: `Z.AI tidak tersedia: ${errors.find(e => e.provider === 'z-ai')?.detail || 'Unknown'}. Untuk fallback, konfigurasi API key NaraRouter (https://router.bynara.id) / Gemini / Groq via ikon ⚙️ di chat AI.`,
      provider: 'none',
    };
  }

  // Build user-friendly error message with actual details
  const errorParts = errors.map(e => {
    const d = e.detail;
    if (d.includes('API_KEY_INVALID') || d.includes('API key not valid') || d.includes('Invalid API Key') || d.includes('invalid_api_key')) {
      return `${e.provider}: API Key tidak valid`;
    }
    return `${e.provider}: ${d.substring(0, 300)}`;
  });

  return {
    success: false,
    content: '',
    error: `Semua provider AI gagal. ${errorParts.join(' | ')}`,
    provider: 'all-failed',
  };
}

/**
 * Call Z.AI Vision model (GLM-4V) — AI can "see" images.
 *
 * Used for Screenshot Mode in AI chat: when user enables "📸 Mode Lihat Halaman",
 * the frontend captures a screenshot of the current page and sends it here.
 * The vision model analyzes both the image AND the user's text question,
 * with the same system prompt (peran, aturan, data context) as text mode.
 *
 * Note: Vision model is slower (3-5s) and uses more tokens than text mode.
 * Only use when image context is genuinely needed (charts, tables, layouts).
 *
 * @returns UnifiedAIResult — same interface as callAI
 */
export async function callVisionAI(options: VisionAIOptions): Promise<UnifiedAIResult> {
  try {
    // Reuse the memoized Z.AI instance (same as callZAI)
    const zai = await getZai();

    // Build user message content: text + image
    const userContent = [
      { type: 'text' as const, text: options.userText },
      { type: 'image_url' as const, image_url: { url: options.imageDataUrl } },
    ];

    // Z.AI uses 'assistant' role for system prompts (same convention as callZAI)
    const messages: Array<{ role: 'assistant' | 'user'; content: any }> = [
      { role: 'assistant', content: options.systemPrompt },
      ...(options.history || []).map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ];

    console.log(`[AI SDK] Calling Z.AI Vision (GLM-4V), image size=${Math.round(options.imageDataUrl.length / 1024)}KB, history=${options.history?.length || 0}msgs`);

    const completion = await withTimeout(
      zai.chat.completions.createVision({
        messages,
        thinking: { type: 'disabled' },
      }),
      60000,
      'Z.AI-Vision'
    );

    // Handle API-level error responses (same pattern as callZAI)
    if (completion && typeof completion === 'object' && !completion.choices) {
      const apiError = completion as Record<string, unknown>;
      const code = apiError.code;
      const msg = apiError.msg || apiError.message || '';
      if (code || apiError.success === false) {
        const errorDetail = `Z.AI Vision API error (code=${code}): ${msg}`;
        console.warn('[AI SDK] Z.AI Vision API returned error:', errorDetail);
        return {
          success: false,
          content: '',
          error: code === 1000
            ? `Z.AI API key tidak valid untuk Vision. Gunakan API key resmi dari https://chat.z.ai → Settings.`
            : errorDetail,
          provider: 'z-ai-vision',
        };
      }
    }

    const content = completion.choices?.[0]?.message?.content || '';

    if (!content || !content.trim()) {
      console.warn('[AI SDK] Z.AI Vision returned empty content');
      return {
        success: false,
        content: '',
        error: 'Model vision mengembalikan respons kosong. Coba ulangi atau nonaktifkan Mode Lihat Halaman.',
        provider: 'z-ai-vision',
      };
    }

    console.log(`[AI SDK] Z.AI Vision SUCCESS, content length=${content.length}`);
    return {
      success: true,
      content,
      provider: 'z-ai-vision',
      model: completion.model || 'glm-4v',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[AI SDK] Z.AI Vision error:', message);
    let helpfulError = message;
    if (message.includes('status 404')) {
      helpfulError = `Endpoint vision tidak ditemukan (404). Pastikan Z.AI SDK versi terbaru. Detail: ${message}`;
    } else if (message.includes('Authentication Failed') || message.includes('1000')) {
      helpfulError = `Z.AI API key tidak valid. Dapatkan API key dari https://chat.z.ai → Settings. Detail: ${message}`;
    } else if (message.includes('timed out')) {
      helpfulError = `Vision model timeout — model butuh waktu lebih dari 60s. Coba gambar lebih kecil atau ulangi.`;
    }
    return {
      success: false,
      content: '',
      error: helpfulError,
      provider: 'z-ai-vision',
    };
  }
}

/**
 * Check if any AI provider is available (sync — only checks env vars)
 * Note: Z.AI is checked dynamically at call time
 */
export function isAIAvailable(): boolean {
  return isNaraConfigured() || isGeminiConfigured() || isGroqConfigured(); // z-ai is dynamically checked
}

/**
 * Check if any AI provider is available (async — checks all providers including Z.AI)
 * This is the accurate check for server-side use.
 */
export async function isAIAvailableAsync(): Promise<boolean> {
  const [nara, gemini, groq] = await Promise.all([
    isNaraConfiguredAsync(),
    isGeminiConfiguredAsync(),
    isGroqConfiguredAsync(),
  ]);
  // Z.AI is always potentially available — check dynamically
  if (nara || gemini || groq) return true;
  // If no key-based providers, check if Z.AI config is available
  return await checkZaiAvailable();
}

/**
 * Get status info about available AI providers (async — checks all providers)
 */
export async function getAIProviderStatusAsync(): Promise<{
  zai: { available: boolean; model: string; priority: number };
  nara: { configured: boolean; model: string; priority: number };
  gemini: { configured: boolean; model: string; priority: number };
  groq: { configured: boolean; model: string; priority: number };
}> {
  const [naraReady, geminiReady, groqReady, zaiAvailable] = await Promise.all([
    isNaraConfiguredAsync(),
    isGeminiConfiguredAsync(),
    isGroqConfiguredAsync(),
    checkZaiAvailable().then(z => z !== null),
  ]);
  return {
    zai: {
      available: zaiAvailable,
      model: 'GLM-4-Plus (auto)',
      priority: 1,
    },
    nara: {
      configured: naraReady,
      model: getNaraModel(),
      priority: 2,
    },
    gemini: {
      configured: geminiReady,
      model: getGeminiModel(),
      priority: 3,
    },
    groq: {
      configured: groqReady,
      model: getGroqModel(),
      priority: 4,
    },
  };
}

/**
 * Get status info about available AI providers (sync — only checks env vars)
 * @deprecated Use getAIProviderStatusAsync() for accurate DB-aware checks
 */
export function getAIProviderStatus(): {
  zai: { available: boolean; model: string; priority: number };
  nara: { configured: boolean; model: string; priority: number };
  gemini: { configured: boolean; model: string; priority: number };
  groq: { configured: boolean; model: string; priority: number };
} {
  return {
    zai: {
      available: true, // dynamically checked at call time
      model: 'GLM-4-Plus (auto)',
      priority: 1,
    },
    nara: {
      configured: isNaraConfigured(),
      model: getNaraModel(),
      priority: 2,
    },
    gemini: {
      configured: isGeminiConfigured(),
      model: getGeminiModel(),
      priority: 3,
    },
    groq: {
      configured: isGroqConfigured(),
      model: getGroqModel(),
      priority: 4,
    },
  };
}
