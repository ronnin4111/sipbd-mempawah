import { geminiChatCompletion, isGeminiConfigured, getGeminiModel } from './gemini-ai';
import { groqChatCompletion, isGroqConfigured, getGroqModel } from './groq-ai';

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
 *    - Fallback models: llama-3.1-8b-instant, gemma2-9b-it
 *    - LPU hardware accelerator for blazing fast responses
 * 3. z-ai-web-dev-sdk (fallback 2 — works in sandbox/local dev only)
 *    - Requires .z-ai-config file (not available on Vercel)
 *
 * Previously used Hugging Face Inference API, but free credits run out monthly.
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
 * 1. Google Gemini API (if GEMINI_API_KEY is set) — works on Vercel
 * 2. Groq API (if GROQ_API_KEY is set) — ultra-fast fallback on Vercel
 * 3. z-ai-web-dev-sdk (if .z-ai-config is available) — local dev only
 */
export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  const errors: string[] = [];

  // 1. Try Google Gemini API first (works on Vercel + local)
  if (isGeminiConfigured()) {
    console.log('[AI SDK] Trying Google Gemini...');
    const result = await geminiChatCompletion({
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    });

    if (result.success) {
      return {
        success: true,
        content: result.content,
        provider: 'google-gemini',
        model: result.model || getGeminiModel(),
      };
    }

    errors.push(`Gemini: ${result.error}`);
    console.warn('[AI SDK] Gemini failed:', result.error?.substring(0, 100));
  }

  // 2. Try Groq as fallback (works on Vercel + local)
  if (isGroqConfigured()) {
    console.log('[AI SDK] Trying Groq fallback...');
    const result = await groqChatCompletion({
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    });

    if (result.success) {
      return {
        success: true,
        content: result.content,
        provider: 'groq',
        model: result.model || getGroqModel(),
      };
    }

    errors.push(`Groq: ${result.error}`);
    console.warn('[AI SDK] Groq failed:', result.error?.substring(0, 100));
  }

  // 3. Try z-ai as local fallback (only works in sandbox)
  console.log('[AI SDK] Trying z-ai local fallback...');
  const zaiResult = await callZAI(options);
  if (zaiResult.success) {
    return zaiResult;
  }

  errors.push(`z-ai: ${zaiResult.error}`);

  // 4. All providers failed — return combined error
  const availableProviders: string[] = [];
  if (isGeminiConfigured()) availableProviders.push('Gemini');
  if (isGroqConfigured()) availableProviders.push('Groq');

  if (availableProviders.length === 0) {
    return {
      success: false,
      content: '',
      error: 'Tidak ada provider AI yang tersedia. Set GEMINI_API_KEY (https://aistudio.google.com/apikey) atau GROQ_API_KEY (https://console.groq.com) — keduanya gratis!',
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
