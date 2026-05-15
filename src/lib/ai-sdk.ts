import { geminiChatCompletion, isGeminiConfigured, isGeminiConfiguredAsync, getGeminiModel } from './gemini-ai';
import { groqChatCompletion, isGroqConfigured, isGroqConfiguredAsync, getGroqModel } from './groq-ai';
import { db } from './db';

/**
 * Unified AI SDK helper — Multi-provider with automatic fallback.
 *
 * Strategy:
 * 1. Google Gemini API (primary — works everywhere, generous free tier)
 *    - Free: 15 RPM, 1500 RPD for gemini-2.0-flash (default)
 *    - Fallback models: gemini-2.5-flash-preview, gemini-1.5-flash
 *    - No monthly credit limits (unlike Hugging Face)
 * 2. Groq API (fallback 1 — ultra-fast inference, very generous free tier)
 *    - Free: 30 RPM, 6000 RPD for llama-3.3-70b-versatile (default)
 *    - Fallback models: llama-3.1-8b-instant, llama-3.2-3b-preview, mixtral-8x7b-32768
 *    - LPU hardware accelerator for blazing fast responses
 * 3. z-ai-web-dev-sdk (fallback 2 — works in sandbox/local dev only)
 *    - Requires .z-ai-config file (not available on Vercel)
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
 * Try calling z-ai-web-dev-sdk as a fallback provider.
 * Only works in environments where .z-ai-config is available (local dev / sandbox).
 */
async function callZAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  try {
    // Dynamic import with cache busting to avoid stale module state
    const ZAI = (await import('z-ai-web-dev-sdk')).default;

    // Create a fresh instance each time
    let zai;
    try {
      zai = await ZAI.create();
    } catch (createError) {
      // If create() fails (config not found), try reading config manually
      const errMsg = createError instanceof Error ? createError.message : 'Unknown';
      console.warn('[AI SDK] z-ai create() failed:', errMsg.substring(0, 200));

      if (errMsg.includes('Configuration file not found') || errMsg.includes('config')) {
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
                console.log('[AI SDK] z-ai config loaded manually from:', configPath);
                zai = new ZAI(config);
                break;
              }
            } catch {
              // Continue to next path
            }
          }
        } catch (fsError) {
          console.warn('[AI SDK] z-ai manual config read failed:', fsError);
        }
      }

      if (!zai) {
        throw createError;
      }
    }

    // z-ai uses 'assistant' role for system prompts
    const messages = options.messages.map(m => ({
      role: m.role === 'system' ? ('assistant' as const) : (m.role as 'user' | 'assistant'),
      content: m.content,
    }));

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const content = completion.choices?.[0]?.message?.content || '';
    return {
      success: true,
      content,
      provider: 'z-ai',
      model: completion.model || 'z-ai',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[AI SDK] z-ai fallback not available:', message);
    return {
      success: false,
      content: '',
      error: message,
      provider: 'z-ai',
    };
  }
}

/**
 * Call AI using the best available provider with automatic fallback.
 *
 * Key resolution: DB-stored keys are passed DIRECTLY to client constructors.
 * No process.env mutation — works correctly in Vercel serverless functions.
 *
 * Priority:
 * 1. Google Gemini API (if key available via env or DB) — works on Vercel
 * 2. Groq API (if key available via env or DB) — ultra-fast fallback on Vercel
 * 3. z-ai-web-dev-sdk (if .z-ai-config is available) — local dev only
 */
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

export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  const errors: Array<{ provider: string; detail: string }> = [];
  const startTime = Date.now();

  // Resolve API keys from env + database
  console.log('[AI SDK] Resolving API keys...');
  const geminiKey = await getApiKey('GEMINI_API_KEY', 'ai_gemini_api_key');
  const groqKey = await getApiKey('GROQ_API_KEY', 'ai_groq_api_key');
  const geminiModel = await getModel('GEMINI_MODEL', 'ai_gemini_model');
  const groqModel = await getModel('GROQ_MODEL', 'ai_groq_model');

  console.log(`[AI SDK] Keys resolved: Gemini=${geminiKey ? 'yes(' + geminiKey.substring(0, 6) + '...)' : 'no'}, Groq=${groqKey ? 'yes(' + groqKey.substring(0, 6) + '...)' : 'no'}`);
  console.log(`[AI SDK] Models resolved: Gemini=${geminiModel || 'default'}, Groq=${groqModel || 'default'}`);

  // 1. Try Google Gemini API first — pass key directly
  if (geminiKey) {
    console.log('[AI SDK] Trying Google Gemini...');
    try {
      const geminiStart = Date.now();
      const result = await withTimeout(
        geminiChatCompletion({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          apiKey: geminiKey,          // Pass directly — no env var mutation
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

  // 2. Try Groq as fallback — pass key directly
  if (groqKey) {
    console.log('[AI SDK] Trying Groq fallback...');
    try {
      const groqStart = Date.now();
      const result = await withTimeout(
        groqChatCompletion({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          apiKey: groqKey,            // Pass directly — no env var mutation
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

  // 3. Try z-ai as local fallback (only works in sandbox)
  console.log('[AI SDK] Trying z-ai local fallback...');
  const zaiResult = await callZAI(options);
  if (zaiResult.success) {
    return zaiResult;
  }

  errors.push({ provider: 'z-ai', detail: zaiResult.error || 'Not available' });

  // If all providers failed but at least one had a rate limit error,
  // try the first available provider once more after a delay
  const hasRateLimit = errors.some(e =>
    e.detail.includes('429') || e.detail.includes('rate') || e.detail.includes('RESOURCE_EXHAUSTED')
  );
  if (hasRateLimit) {
    console.log('[AI SDK] Rate limit detected, retrying primary provider after 3s delay...');
    await new Promise(resolve => setTimeout(resolve, 3000));

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

  // 4. All providers failed — return combined error with helpful message
  if (!geminiKey && !groqKey) {
    return {
      success: false,
      content: '',
      error: '🔑 API Key belum dikonfigurasi. Klik ikon ⚙️ di chat AI untuk mengatur API key (Gemini/Groq — gratis!).',
      provider: 'none',
    };
  }

  // Build user-friendly error message with actual details
  const errorParts = errors.map(e => {
    // Show actual error details for debugging — don't over-classify
    const d = e.detail;
    if (d.includes('API_KEY_INVALID') || d.includes('API key not valid') || d.includes('Invalid API Key') || d.includes('invalid_api_key')) {
      return `${e.provider}: API Key tidak valid`;
    }
    // For all other errors, show the raw detail (up to 300 chars) for diagnostics
    // This helps us see the ACTUAL error instead of a generic "Rate limited" message
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
 * Check if any AI provider is available (sync — only checks env vars)
 */
export function isAIAvailable(): boolean {
  return isGeminiConfigured() || isGroqConfigured(); // z-ai is dynamically checked
}

/**
 * Check if any AI provider is available (async — checks env vars AND DB)
 * This is the accurate check for server-side use.
 */
export async function isAIAvailableAsync(): Promise<boolean> {
  const [gemini, groq] = await Promise.all([
    isGeminiConfiguredAsync(),
    isGroqConfiguredAsync(),
  ]);
  return gemini || groq; // z-ai is dynamically checked at call time
}

/**
 * Get status info about available AI providers (async — checks env vars AND DB)
 */
export async function getAIProviderStatusAsync(): Promise<{
  gemini: { configured: boolean; model: string };
  groq: { configured: boolean; model: string };
  zai: { available: boolean };
}> {
  const [geminiReady, groqReady] = await Promise.all([
    isGeminiConfiguredAsync(),
    isGroqConfiguredAsync(),
  ]);
  return {
    gemini: {
      configured: geminiReady,
      model: getGeminiModel(),
    },
    groq: {
      configured: groqReady,
      model: getGroqModel(),
    },
    zai: {
      available: false, // dynamically checked at call time
    },
  };
}

/**
 * Get status info about available AI providers (sync — only checks env vars)
 * @deprecated Use getAIProviderStatusAsync() for accurate DB-aware checks
 */
export function getAIProviderStatus(): {
  gemini: { configured: boolean; model: string };
  groq: { configured: boolean; model: string };
  zai: { available: boolean };
} {
  return {
    gemini: {
      configured: isGeminiConfigured(),
      model: getGeminiModel(),
    },
    groq: {
      configured: isGroqConfigured(),
      model: getGroqModel(),
    },
    zai: {
      available: false, // dynamically checked at call time
    },
  };
}
