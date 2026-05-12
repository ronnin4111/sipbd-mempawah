import { geminiChatCompletion, isGeminiConfigured, getGeminiModel } from './gemini-ai';

/**
 * Unified AI SDK helper — Multi-provider with automatic fallback.
 *
 * Strategy:
 * 1. Google Gemini API (primary — works everywhere, generous free tier)
 *    - Free: 15 RPM, 1500 RPD for Gemini 2.0 Flash
 *    - No monthly credit limits (unlike Hugging Face)
 * 2. z-ai-web-dev-sdk (fallback — works in sandbox/local dev only)
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
    console.warn('z-ai fallback not available:', message);
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
 * 2. z-ai-web-dev-sdk (if .z-ai-config is available) — local dev fallback
 */
export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  // 1. Try Google Gemini API first (works on Vercel + local)
  if (isGeminiConfigured()) {
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

    // If Gemini fails, try z-ai as fallback
    console.warn('Gemini API failed, trying z-ai fallback:', result.error);
    const zaiResult = await callZAI(options);
    if (zaiResult.success) {
      return zaiResult;
    }

    // Both failed — return Gemini error
    return {
      success: false,
      content: '',
      error: result.error,
      provider: 'google-gemini',
      model: result.model || getGeminiModel(),
    };
  }

  // 2. No Gemini key — try z-ai as local fallback
  const zaiResult = await callZAI(options);
  if (zaiResult.success) {
    return zaiResult;
  }

  // 3. No provider available
  return {
    success: false,
    content: '',
    error: 'Tidak ada provider AI yang tersedia. Set GEMINI_API_KEY untuk Google Gemini (gratis, https://aistudio.google.com/apikey) atau gunakan lingkungan dengan z-ai-web-dev-sdk.',
    provider: 'none',
  };
}

/**
 * Check if any AI provider is available
 */
export function isAIAvailable(): boolean {
  return isGeminiConfigured(); // z-ai is dynamically checked
}
