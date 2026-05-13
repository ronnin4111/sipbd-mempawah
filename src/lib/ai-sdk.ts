import { geminiChatCompletion, isGeminiConfigured, getGeminiModel } from './gemini-ai';
import { groqChatCompletion, isGroqConfigured, getGroqModel } from './groq-ai';
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
 * API Key Resolution:
 * - First checks environment variables (GEMINI_API_KEY, GROQ_API_KEY)
 * - Then checks AppSetting database (ai_gemini_api_key, ai_groq_api_key)
 * - This allows configuring API keys from the app UI without Vercel dashboard
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
 */
async function getApiKey(envVarName: string, dbSettingKey: string): Promise<string | null> {
  // 1. Check environment variable first
  const envKey = process.env[envVarName];
  if (envKey) return envKey;

  // 2. Check database setting
  try {
    const setting = await db.appSetting.findUnique({ where: { key: dbSettingKey } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
    }
  } catch {
    // Ignore DB errors — fall through
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
    // Ignore DB errors
  }

  return null;
}

/**
 * Try calling z-ai-web-dev-sdk as a fallback provider.
 * Only works in environments where .z-ai-config is available (local dev / sandbox).
 */
async function callZAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

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
 * Priority:
 * 1. Google Gemini API (if key available via env or DB) — works on Vercel
 * 2. Groq API (if key available via env or DB) — ultra-fast fallback on Vercel
 * 3. z-ai-web-dev-sdk (if .z-ai-config is available) — local dev only
 */
export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  const errors: string[] = [];

  // Resolve API keys from env + database
  const geminiKey = await getApiKey('GEMINI_API_KEY', 'ai_gemini_api_key');
  const groqKey = await getApiKey('GROQ_API_KEY', 'ai_groq_api_key');
  const geminiModel = await getModel('GEMINI_MODEL', 'ai_gemini_model');
  const groqModel = await getModel('GROQ_MODEL', 'ai_groq_model');

  // 1. Try Google Gemini API first (works on Vercel + local)
  if (geminiKey) {
    console.log('[AI SDK] Trying Google Gemini...');
    try {
      // Temporarily set env vars for the Gemini client to pick up
      const prevKey = process.env.GEMINI_API_KEY;
      const prevModel = process.env.GEMINI_MODEL;
      process.env.GEMINI_API_KEY = geminiKey;
      if (geminiModel) process.env.GEMINI_MODEL = geminiModel;

      // Reset singleton so it picks up new key
      const { resetGeminiInstance } = await import('./gemini-ai');
      resetGeminiInstance();

      const result = await geminiChatCompletion({
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      });

      // Restore env vars
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
      if (prevModel) process.env.GEMINI_MODEL = prevModel;
      else delete process.env.GEMINI_MODEL;
      resetGeminiInstance();

      if (result.success) {
        return {
          success: true,
          content: result.content,
          provider: 'google-gemini',
          model: result.model || geminiModel || 'gemini-2.0-flash',
        };
      }

      errors.push(`Gemini: ${result.error}`);
      console.warn('[AI SDK] Gemini failed:', result.error?.substring(0, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Gemini: ${msg.substring(0, 100)}`);
      console.warn('[AI SDK] Gemini exception:', msg.substring(0, 100));
    }
  }

  // 2. Try Groq as fallback (works on Vercel + local)
  if (groqKey) {
    console.log('[AI SDK] Trying Groq fallback...');
    try {
      const prevKey = process.env.GROQ_API_KEY;
      const prevModel = process.env.GROQ_MODEL;
      process.env.GROQ_API_KEY = groqKey;
      if (groqModel) process.env.GROQ_MODEL = groqModel;

      // Reset singleton so it picks up new key
      const { resetGroqInstance } = await import('./groq-ai');
      resetGroqInstance();

      const result = await groqChatCompletion({
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      });

      // Restore env vars
      if (prevKey) process.env.GROQ_API_KEY = prevKey;
      else delete process.env.GROQ_API_KEY;
      if (prevModel) process.env.GROQ_MODEL = prevModel;
      else delete process.env.GROQ_MODEL;
      resetGroqInstance();

      if (result.success) {
        return {
          success: true,
          content: result.content,
          provider: 'groq',
          model: result.model || groqModel || 'llama-3.3-70b-versatile',
        };
      }

      errors.push(`Groq: ${result.error}`);
      console.warn('[AI SDK] Groq failed:', result.error?.substring(0, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Groq: ${msg.substring(0, 100)}`);
      console.warn('[AI SDK] Groq exception:', msg.substring(0, 100));
    }
  }

  // 3. Try z-ai as local fallback (only works in sandbox)
  console.log('[AI SDK] Trying z-ai local fallback...');
  const zaiResult = await callZAI(options);
  if (zaiResult.success) {
    return zaiResult;
  }

  errors.push(`z-ai: ${zaiResult.error}`);

  // 4. All providers failed — return combined error with helpful message
  if (!geminiKey && !groqKey) {
    return {
      success: false,
      content: '',
      error: '🔑 API Key belum dikonfigurasi. Klik ikon ⚙️ di chat AI untuk mengatur API key (Gemini/Groq — gratis!).',
      provider: 'none',
    };
  }

  // Some providers were configured but all failed
  return {
    success: false,
    content: '',
    error: `Semua provider AI gagal. ${errors.join(' | ')}`,
    provider: 'all-failed',
  };
}

/**
 * Check if any AI provider is available
 */
export function isAIAvailable(): boolean {
  return isGeminiConfigured() || isGroqConfigured(); // z-ai is dynamically checked
}

/**
 * Get status info about available AI providers
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
