/**
 * Google Gemini AI Client — Optimized for Free Tier
 *
 * Uses the official @google/generative-ai SDK for reliable API access.
 * Works on both local dev and Vercel deployment.
 *
 * Google Gemini Free Tier (as of 2025):
 * - gemini-2.0-flash: 15 RPM, 1500 RPD ✅ (RECOMMENDED - most reliable free tier)
 * - gemini-2.5-flash-preview-05-20: 10 RPM (preview, may have limits)
 * - gemini-2.0-flash-lite: ⚠️ quota limit may be 0 on some projects
 *
 * IMPORTANT: Free tier limits are PER API KEY, shared across all users.
 * If your key is used elsewhere, limits may be reached faster.
 *
 * Environment variables:
 * - GEMINI_API_KEY: Your Google AI Studio API key (required)
 * - GEMINI_MODEL: Model ID to use (default: gemini-2.0-flash)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Use gemini-2.0-flash as default — reliable free tier with 15 RPM, 1500 RPD
const DEFAULT_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 1; // Reduced from 2 to 1 — avoid consuming rate limit budget
const RETRY_DELAY_MS = 2000;

// [H-3] Per-apiKey instance cache. The `GoogleGenerativeAI` constructor is
// cheap but allocation-per-call is wasteful when the same key is reused.
// Keyed by apiKey string so different keys (e.g. env vs DB-stored) get their
// own instances. NOTE: previous comment said "Singleton pattern removed —
// no module-level caching"; that was true for the global-singleton variant
// (which broke when apiKey changed at runtime). This Map-based cache avoids
// that issue while still avoiding per-call allocation.
const geminiInstances = new Map<string, GoogleGenerativeAI>();
function getGemini(apiKey: string): GoogleGenerativeAI {
  let inst = geminiInstances.get(apiKey);
  if (!inst) {
    inst = new GoogleGenerativeAI(apiKey);
    geminiInstances.set(apiKey, inst);
  }
  return inst;
}

/**
 * Check if Google Gemini API is configured.
 * Checks both environment variables AND database-stored keys.
 * Sync version for quick checks; use isGeminiConfiguredAsync() for full check.
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Async version: checks both env vars AND database for API key.
 * This is the accurate check — the sync version only checks env vars.
 */
export async function isGeminiConfiguredAsync(): Promise<boolean> {
  if (process.env.GEMINI_API_KEY) return true;
  try {
    const { db } = await import('./db');
    const setting = await db.appSetting.findUnique({ where: { key: 'ai_gemini_api_key' } });
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
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Internal helper: Try generating chat completion with a specific model.
 * Returns the result or throws the error.
 */
async function tryModelChat(
  genAI: GoogleGenerativeAI,
  modelId: string,
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // Extract system prompt if present
  const systemMessage = options.messages.find(m => m.role === 'system');
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  // Create the model with system instruction if provided
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemMessage?.content || undefined,
    generationConfig: {
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.max_tokens ?? DEFAULT_MAX_TOKENS,
      topP: options.top_p ?? 0.95,
    },
  });

  // Convert messages to Gemini format (Gemini uses "user" and "model" roles)
  const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const msg of nonSystemMessages) {
    const role = msg.role === 'assistant' ? 'model' as const : 'user' as const;

    // Gemini requires alternating user/model messages.
    // If we have consecutive same-role messages, merge them.
    if (history.length > 0 && history[history.length - 1].role === role) {
      history[history.length - 1].parts.push({ text: msg.content });
    } else {
      history.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // The last message should be the current user message
  // We separate it for the generateContent call
  let currentMessage = '';
  if (history.length > 0 && history[history.length - 1].role === 'user') {
    const lastEntry = history.pop()!;
    currentMessage = lastEntry.parts.map(p => p.text).join('\n');
  } else if (history.length > 0 && history[history.length - 1].role === 'model') {
    // If the last message is from the model, we need a user message
    currentMessage = 'Lanjutkan percakapan ini.';
  } else {
    currentMessage = 'Halo';
  }

  // Start a chat session with history
  const chat = model.startChat({ history });

  const result = await chat.sendMessage(currentMessage);
  const response = result.response;
  const content = response.text();

  // Get usage metadata if available
  const usageMetadata = response.usageMetadata;

  return {
    success: true,
    content,
    model: modelId,
    usage: usageMetadata
      ? {
          prompt_tokens: usageMetadata.promptTokenCount ?? 0,
          completion_tokens: usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Call the Google Gemini API for chat completions.
 * Includes retry logic for rate limit errors AND model fallback.
 *
 * If the primary model fails with quota/rate-limit, automatically
 * tries fallback models before giving up.
 *
 * @param options.apiKey - Direct API key (overrides env var). Used for DB-stored keys.
 */
export async function geminiChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // Resolve API key: direct parameter > env var
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      error: 'GEMINI_API_KEY belum dikonfigurasi. Dapatkan API key gratis di https://aistudio.google.com/apikey',
    };
  }

  // Create instance with the resolved key — cached per apiKey [H-3]
  const genAI = getGemini(apiKey);

  const primaryModel = options.model || getGeminiModel();
  // Build the list of models to try: primary first, then fallbacks
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  // Track the first error from each model for better diagnostics
  const firstErrorsByModel = new Map<string, string>();
  let isNetworkError = false; // If true, skip remaining models (same endpoint)

  for (const modelId of modelsToTry) {
    // If we detected a network error, skip remaining models — they use the same endpoint
    if (isNetworkError) {
      console.warn(`[Gemini] Skipping model ${modelId} — network error detected`);
      firstErrorsByModel.set(modelId, 'Skipped: network error');
      continue;
    }

    // Try up to MAX_RETRIES + 1 times per model
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Gemini] Trying model: ${modelId} (attempt ${attempt + 1})`);
        const result = await tryModelChat(genAI, modelId, options);
        if (result.success) {
          console.log(`[Gemini] Success with model: ${modelId}`);
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Gemini] Error with model ${modelId} (attempt ${attempt + 1}):`, message.substring(0, 300));

        // Track first error per model
        if (!firstErrorsByModel.has(modelId)) {
          firstErrorsByModel.set(modelId, message.substring(0, 200));
        }

        // Check if this is a network error (fetch failed, DNS error, timeout)
        // Network errors affect ALL models — no point trying others
        if (message.includes('Error fetching') || message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT') || message.includes('network') || message.includes('Failed to fetch')) {
          console.error(`[Gemini] Network error detected for model ${modelId} — skipping remaining models`);
          isNetworkError = true;
          break; // Don't retry, and skip remaining models
        }

        // Check if this is a retryable error (rate limit)
        const isRateLimit = message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('rate');
        // Check if this is a model-not-found or model-unavailable error
        const isModelUnavailable = message.includes('404') || message.includes('NOT_FOUND') || message.includes('model not found');

        // If model is not found/unavailable, skip to next model immediately
        if (isModelUnavailable) {
          console.warn(`[Gemini] Model ${modelId} not available, trying next model...`);
          break; // break out of retry loop, continue to next model
        }

        // If it's a quota error with limit:0, try next model instead of retrying
        if (isRateLimit && message.includes('limit: 0')) {
          console.warn(`[Gemini] Model ${modelId} has quota limit 0 (not available on free tier), trying next model...`);
          break; // break out of retry loop, continue to next model
        }

        // If it's a rate limit error and we have retries left, wait and try again
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
          console.log(`[Gemini] Rate limited. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Non-retryable error or out of retries
        if (message.includes('API_KEY_INVALID') || message.includes('401') || message.includes('Unauthorized') || message.includes('API key not valid')) {
          return {
            success: false,
            content: '',
            error: `API Key Gemini tidak valid. Periksa GEMINI_API_KEY Anda. Detail: ${message}`,
          };
        }

        if (isRateLimit) {
          // If this model is rate-limited but we have more models to try, move to next
          if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
            console.warn(`[Gemini] Model ${modelId} rate limited, trying next model...`);
            break; // break out of retry loop, continue to next model
          }
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Batas permintaan Gemini tercapai (${modelId}). Coba lagi dalam 1 menit. Detail per model: ${errSummary}`,
          };
        }

        if (message.includes('400') || message.includes('BAD_REQUEST')) {
          const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
          return {
            success: false,
            content: '',
            error: `Permintaan tidak valid (mungkin terlalu besar). Detail per model: ${errSummary}`,
          };
        }

        if (message.includes('SAFETY') || message.includes('blocked')) {
          return {
            success: false,
            content: '',
            error: 'Respons diblokir oleh filter keamanan Google. Coba reformulasikan pertanyaan Anda.',
          };
        }

        // For other unexpected errors, try next model if available
        if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
          console.warn(`[Gemini] Model ${modelId} failed with unexpected error, trying next model...`);
          break;
        }

        const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
        return {
          success: false,
          content: '',
          error: `Gagal terhubung ke Gemini API. Detail per model: ${errSummary}`,
        };
      }
    }
  }

  // Should never reach here, but just in case
  const errSummary = [...firstErrorsByModel.entries()].map(([m, e]) => `${m}: ${e.substring(0, 80)}`).join('; ');
  return {
    success: false,
    content: '',
    error: `Gagal setelah mencoba semua model Gemini (${modelsToTry.join(', ')}). Detail: ${errSummary}`,
  };
}

/**
 * Simple convenience function for single-turn chat
 */
export async function geminiChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number; apiKey?: string }
): Promise<ChatCompletionResponse> {
  return geminiChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
