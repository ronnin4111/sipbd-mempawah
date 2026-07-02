/**
 * NaraRouter AI Client — OpenAI-Compatible Gateway (Indonesia)
 *
 * Docs: https://router.bynara.id/docs
 * Base URL: https://router.bynara.id/v1
 * Endpoint: POST /chat/completions (OpenAI Chat Completions schema)
 *
 * Why NaraRouter?
 * - Single endpoint routes to Claude / GPT / Gemini / DeepSeek / Kimi / Mistral / etc.
 * - 100% OpenAI-compatible — official `openai` SDK works by changing baseURL + apiKey.
 * - Free tier: 7M tokens/day, 10 RPM (Mistral Large, Mistral Medium 3.5, Claude Sonnet/Haiku 4.5).
 * - Pricing in Rupiah, Indonesian-friendly.
 *
 * Authentication:
 * - Bearer token in Authorization header.
 * - Keys begin with `sk-nry-`.
 *
 * Environment variables:
 * - NARA_ROUTER_API_KEY: Your NaraRouter API key (free at https://router.bynara.id)
 * - NARA_ROUTER_MODEL: Model alias to use (default: mistral-large)
 *
 * DB settings (read by ai-sdk.ts):
 * - ai_nara_router_api_key
 * - ai_nara_router_model
 */

import OpenAI from 'openai';

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

const NARA_BASE_URL = 'https://router.bynara.id/v1';

// Default model — works on Free tier, weight 1 (cheapest), large context (252K)
const DEFAULT_MODEL = 'mistral-large';
// Fallback models — all on Free tier. Order: cheapest → most expensive.
// Note: Claude models (weight 2-3) sometimes reject short prompts with
// bad_request — only use as last-resort fallback.
const FALLBACK_MODELS = ['mistral-medium-3-5'];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

// [H-3] Per-apiKey instance cache. The `OpenAI` constructor opens an HTTP
// client internally; allocating one per call is wasteful when the same key
// is reused. Keyed by apiKey string so different keys (e.g. env vs DB-stored)
// get their own instances.
const naraInstances = new Map<string, OpenAI>();
function getNara(apiKey: string): OpenAI {
  let inst = naraInstances.get(apiKey);
  if (!inst) {
    inst = new OpenAI({
      apiKey,
      baseURL: NARA_BASE_URL,
    });
    naraInstances.set(apiKey, inst);
  }
  return inst;
}

/**
 * Check if NaraRouter API is configured.
 * Checks both environment variables AND database-stored keys.
 * Sync version for quick checks; use isNaraConfiguredAsync() for full check.
 */
export function isNaraConfigured(): boolean {
  return !!process.env.NARA_ROUTER_API_KEY;
}

/**
 * Async version: checks both env vars AND database for API key.
 * This is the accurate check — the sync version only checks env vars.
 */
export async function isNaraConfiguredAsync(): Promise<boolean> {
  if (process.env.NARA_ROUTER_API_KEY) return true;
  try {
    const { db } = await import('./db');
    const setting = await db.appSetting.findUnique({ where: { key: 'ai_nara_router_api_key' } });
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
 * Get the configured model alias
 */
export function getNaraModel(): string {
  return process.env.NARA_ROUTER_MODEL || DEFAULT_MODEL;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call the NaraRouter API for chat completions.
 * Includes retry logic for rate limit errors AND model fallback.
 *
 * @param options.apiKey - Direct API key (overrides env var). Used for DB-stored keys.
 */
export async function naraChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // Resolve API key: direct parameter > env var
  const apiKey = options.apiKey || process.env.NARA_ROUTER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      error: 'NARA_ROUTER_API_KEY belum dikonfigurasi. Dapatkan API key gratis di https://router.bynara.id',
    };
  }

  // Validate key format — NaraRouter keys begin with sk-nry-
  if (!apiKey.startsWith('sk-nry-')) {
    return {
      success: false,
      content: '',
      error: 'Format API key NaraRouter tidak valid. Key harus diawali dengan "sk-nry-". Dapatkan key di https://router.bynara.id',
    };
  }

  // Create an OpenAI client with NaraRouter base URL — cached per apiKey [H-3]
  const client = getNara(apiKey);

  const primaryModel = options.model || getNaraModel();
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  // Track the first error from each model for better diagnostics
  const firstErrorsByModel = new Map<string, string>();
  let isNetworkError = false;

  for (const modelId of modelsToTry) {
    if (isNetworkError) {
      console.warn(`[NaraRouter] Skipping model ${modelId} — network error detected`);
      firstErrorsByModel.set(modelId, 'Skipped: network error');
      continue;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[NaraRouter] Trying model: ${modelId} (attempt ${attempt + 1})`);

        // Build request body — only include optional params if explicitly provided.
        // NaraRouter rejects `top_p` for some models (e.g. mistral-large) with 400,
        // so we DON'T send a default top_p. Caller must opt-in.
        const requestBody: Record<string, unknown> = {
          model: modelId,
          messages: options.messages,
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: options.max_tokens ?? DEFAULT_MAX_TOKENS,
        };
        if (options.top_p !== undefined) {
          requestBody.top_p = options.top_p;
        }

        const response = await client.chat.completions.create(requestBody as Parameters<typeof client.chat.completions.create>[0]);

        const content = response.choices?.[0]?.message?.content || '';

        if (!content) {
          throw new Error('Empty response from NaraRouter API');
        }

        console.log(`[NaraRouter] Success with model: ${modelId}`);

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
        // NaraRouter returns OpenAI-shaped errors with `type` field.
        // The openai SDK throws an `APIError` with .status, .error, .message.
        const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
        const message = err.message || 'Unknown error';
        const errorType = err.error?.type || '';
        console.error(`[NaraRouter] Error with model ${modelId} (attempt ${attempt + 1}):`, message.substring(0, 300));

        if (!firstErrorsByModel.has(modelId)) {
          firstErrorsByModel.set(modelId, message.substring(0, 200));
        }

        // Network error — affects ALL models on this gateway
        if (message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT') || message.includes('network') || message.includes('Failed to fetch') || message.includes('Connection error')) {
          console.error(`[NaraRouter] Network error detected — skipping remaining models`);
          isNetworkError = true;
          break;
        }

        const isRateLimit = err.status === 429 || errorType === 'rate_limited' || message.includes('429') || message.includes('rate');
        const isAuthError = err.status === 401 || errorType === 'unauthorized' || message.includes('401') || message.includes('Invalid API Key') || message.includes('invalid_api_key');
        const isModelUnavailable = err.status === 404 || errorType === 'not_found' || message.includes('404') || message.includes('does not exist');
        const isBadRequest = err.status === 400 || errorType === 'validation_error' || errorType === 'bad_request' || message.includes('400') || message.includes('Bad Request');
        const isForbidden = err.status === 403 || errorType === 'forbidden';

        // Auth error — no point retrying
        if (isAuthError) {
          return {
            success: false,
            content: '',
            error: `API Key NaraRouter tidak valid atau belum diotorisasi. Periksa NARA_ROUTER_API_KEY Anda. Detail: ${message}`,
          };
        }

        // Forbidden — plan doesn't include model
        if (isForbidden) {
          if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
            console.warn(`[NaraRouter] Model ${modelId} not included in plan, trying next model...`);
            break;
          }
          return {
            success: false,
            content: '',
            error: `Model ${modelId} tidak tersedia di plan Anda. Upgrade plan di https://router.bynara.id/pricing atau gunakan model lain. Detail: ${message}`,
          };
        }

        // Model not found — try next
        if (isModelUnavailable) {
          console.warn(`[NaraRouter] Model ${modelId} not found, trying next model...`);
          break;
        }

        // Bad request — some Claude models reject very short prompts.
        // Try next model instead of giving up.
        if (isBadRequest) {
          if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
            console.warn(`[NaraRouter] Model ${modelId} rejected request, trying next model...`);
            break;
          }
          return {
            success: false,
            content: '',
            error: `Permintaan ditolak oleh ${modelId}. Coba reformulasikan pesan Anda. Detail: ${message}`,
          };
        }

        // Rate limited — retry with backoff
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`[NaraRouter] Rate limited. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        if (isRateLimit) {
          if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
            console.warn(`[NaraRouter] Model ${modelId} rate limited, trying next model...`);
            break;
          }
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Batas permintaan NaraRouter tercapai (${modelId}). Free tier: 10 RPM, 7M token/hari. Coba lagi dalam 1 menit. Detail: ${errSummary}`,
          };
        }

        // For other errors, try next model if available
        if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
          console.warn(`[NaraRouter] Model ${modelId} failed with unexpected error, trying next model...`);
          break;
        }

        const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
        return {
          success: false,
          content: '',
          error: `Gagal terhubung ke NaraRouter API. Detail per model: ${errSummary}`,
        };
      }
    }
  }

  const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
  return {
    success: false,
    content: '',
    error: `Gagal setelah mencoba semua model NaraRouter (${modelsToTry.join(', ')}). Detail: ${errSummary}`,
  };
}

/**
 * Simple convenience function for single-turn chat
 */
export async function naraChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number; apiKey?: string }
): Promise<ChatCompletionResponse> {
  return naraChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
