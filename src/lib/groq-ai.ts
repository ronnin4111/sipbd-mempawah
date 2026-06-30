/**
 * Groq AI Client — Fast Inference Fallback Provider
 *
 * Uses the official groq-sdk for ultra-fast LLM inference.
 * Works on both local dev and Vercel deployment.
 *
 * Groq Free Tier (as of 2025):
 * - Rate limits: 30 RPM, 6000 RPD (very generous!)
 * - Tokens: 14,400 tokens/min, 500,000 tokens/day
 * - Ultra-fast inference (LPU hardware accelerator)
 *
 * Supported Models on Free Tier:
 * - llama-3.3-70b-versatile ✅ (RECOMMENDED - best quality)
 * - llama-3.1-8b-instant (fast, lightweight)
 * - llama-3.2-3b-preview (small & fast)
 * - mixtral-8x7b-32768 (long context)
 * - deepseek-r1-distill-llama-70b (reasoning)
 *
 * DECOMMISSIONED (do NOT use):
 * - gemma2-9b-it ❌ (removed March 2025)
 *
 * Environment variables:
 * - GROQ_API_KEY: Your Groq API key (required, free at https://console.groq.com)
 * - GROQ_MODEL: Model ID to use (default: llama-3.3-70b-versatile)
 */

import Groq from 'groq-sdk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  /** Direct API key — overrides env var. Used by AI SDK for DB-stored keys. */
  apiKey?: string;
  /** Direct model override */
  model?: string;
}

export interface ChatCompletionResponse {
  success: boolean;
  content: string;
  error?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Default model — best quality/availability on free tier
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// Fallback models — only models with large context windows
// Removed llama-3.2-3b-preview (too small context, causes 413 errors)
const FALLBACK_MODELS = ['llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 1; // Reduced from 2 to 1 — avoid consuming rate limit budget
const RETRY_DELAY_MS = 2000;

// [H-3] Per-apiKey instance cache. The `Groq` constructor opens an HTTP
// client internally; allocating one per call is wasteful when the same key
// is reused. Keyed by apiKey string so different keys (e.g. env vs DB-stored)
// get their own instances. NOTE: previous comment said "Singleton pattern
// removed — no module-level caching"; that was true for the global-singleton
// variant (which broke when apiKey changed at runtime). This Map-based cache
// avoids that issue while still avoiding per-call allocation.
const groqInstances = new Map<string, Groq>();
function getGroq(apiKey: string): Groq {
  let inst = groqInstances.get(apiKey);
  if (!inst) {
    inst = new Groq({ apiKey });
    groqInstances.set(apiKey, inst);
  }
  return inst;
}

/**
 * Check if Groq API is configured.
 * Checks both environment variables AND database-stored keys.
 * Sync version for quick checks; use isGroqConfiguredAsync() for full check.
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Async version: checks both env vars AND database for API key.
 * This is the accurate check — the sync version only checks env vars.
 */
export async function isGroqConfiguredAsync(): Promise<boolean> {
  if (process.env.GROQ_API_KEY) return true;
  try {
    const { db } = await import('./db');
    const setting = await db.appSetting.findUnique({ where: { key: 'ai_groq_api_key' } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      return typeof parsed === 'string' && parsed.trim().length > 0;
    }
  } catch {
    // DB error — fall through
  }
  return false;
}

/**
 * Get the configured model ID
 */
export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call the Groq API for chat completions.
 * Includes retry logic for rate limit errors AND model fallback.
 *
 * @param options.apiKey - Direct API key (overrides env var). Used for DB-stored keys.
 */
export async function groqChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // Resolve API key: direct parameter > env var
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      error: 'GROQ_API_KEY belum dikonfigurasi. Dapatkan API key gratis di https://console.groq.com',
    };
  }

  // Create a Groq instance with the resolved key — cached per apiKey [H-3]
  const groq = getGroq(apiKey);

  const primaryModel = options.model || getGroqModel();
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  // Track the first error from each model for better diagnostics
  const firstErrorsByModel = new Map<string, string>();
  let isNetworkError = false; // If true, skip remaining models (same endpoint)
  let sawTooLargeError = false; // If true, include context-size hint in final error

  for (const modelId of modelsToTry) {
    // If we detected a network error, skip remaining models — they use the same endpoint
    if (isNetworkError) {
      console.warn(`[Groq] Skipping model ${modelId} — network error detected`);
      firstErrorsByModel.set(modelId, 'Skipped: network error');
      continue;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Groq] Trying model: ${modelId} (attempt ${attempt + 1})`);

        const response = await groq.chat.completions.create({
          model: modelId,
          messages: options.messages,
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: options.max_tokens ?? DEFAULT_MAX_TOKENS,
          top_p: options.top_p ?? 0.95,
        });

        const content = response.choices?.[0]?.message?.content || '';

        if (!content) {
          throw new Error('Empty response from Groq API');
        }

        console.log(`[Groq] Success with model: ${modelId}`);

        return {
          success: true,
          content,
          model: modelId,
          usage: response.usage
            ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Groq] Error with model ${modelId} (attempt ${attempt + 1}):`, message.substring(0, 300));

        // Track first error per model
        if (!firstErrorsByModel.has(modelId)) {
          firstErrorsByModel.set(modelId, message.substring(0, 200));
        }

        // Check if this is a network error (fetch failed, DNS error, timeout)
        // Network errors affect ALL models — no point trying others
        if (message.includes('Error fetching') || message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT') || message.includes('network') || message.includes('Failed to fetch') || message.includes('Connection error')) {
          console.error(`[Groq] Network error detected for model ${modelId} — skipping remaining models`);
          isNetworkError = true;
          break; // Don't retry, and skip remaining models
        }

        // Check error types
        const isRateLimit = message.includes('429') || message.includes('rate_limit') || message.includes('Rate limit');
        const isAuthError = message.includes('401') || message.includes('Invalid API Key') || message.includes('invalid_api_key');
        const isModelUnavailable = message.includes('404') || message.includes('model_not_found') || message.includes('does not exist');
        const isDecommissioned = message.includes('decommissioned') || message.includes('no longer supported');

        // If model decommissioned or not found, try next model
        if (isModelUnavailable || isDecommissioned) {
          console.warn(`[Groq] Model ${modelId} not available (decommissioned/not found), trying next model...`);
          break;
        }

        // Request too large for this model — try next model with larger context
        const isTooLarge = message.includes('413') || message.includes('Request too large') || message.includes('too many tokens') || message.includes('request_too_large');
        if (isTooLarge) {
          sawTooLargeError = true;
          const estimatedChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);
          const estimatedTokens = Math.round(estimatedChars / 4); // rough estimate: ~4 chars per token
          console.warn(`[Groq] Model ${modelId}: Request too large (estimated ~${estimatedTokens} tokens / ${estimatedChars} chars), trying next model with larger context...`);
          break; // Skip to next model (don't retry same model with same prompt)
        }

        // If auth error, no point retrying
        if (isAuthError) {
          return {
            success: false,
            content: '',
            error: `API Key Groq tidak valid. Periksa GROQ_API_KEY Anda. Detail: ${message}`,
          };
        }

        // If rate limited, retry with backoff
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`[Groq] Rate limited. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // If rate limited and no retries left, try next model
        if (isRateLimit) {
          if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
            console.warn(`[Groq] Model ${modelId} rate limited, trying next model...`);
            break;
          }
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Batas permintaan Groq tercapai (${modelId}). Coba lagi dalam 1 menit. Detail per model: ${errSummary}`,
          };
        }

        // Bad request error
        if (message.includes('400') || message.includes('Bad Request')) {
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Permintaan tidak valid. Detail per model: ${errSummary}`,
          };
        }

        // Context length exceeded
        if (message.includes('context_length') || message.includes('too many tokens')) {
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Pesan terlalu panjang untuk model ini. Coba persingkat percakapan Anda. Detail per model: ${errSummary}`,
          };
        }

        // For other errors, try next model if available
        if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
          console.warn(`[Groq] Model ${modelId} failed with unexpected error, trying next model...`);
          break;
        }

        const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
        return {
          success: false,
          content: '',
          error: `Gagal terhubung ke Groq API. Detail per model: ${errSummary}`,
        };
      }
    }
  }

  const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
  const tooLargeHint = sawTooLargeError ? ' Prompt terlalu panjang untuk semua model — coba persingkat percakapan Anda.' : '';
  return {
    success: false,
    content: '',
    error: `Gagal setelah mencoba semua model Groq (${modelsToTry.join(', ')}).${tooLargeHint} Detail: ${errSummary}`,
  };
}

/**
 * Simple convenience function for single-turn chat
 */
export async function groqChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number; apiKey?: string }
): Promise<ChatCompletionResponse> {
  return groqChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
