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
const FALLBACK_MODELS = ['llama-3.1-8b-instant', 'llama-3.2-3b-preview', 'mixtral-8x7b-32768'];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Singleton instance
let groqInstance: Groq | null = null;

/**
 * Reset the singleton instance (used when API key changes dynamically)
 */
export function resetGroqInstance(): void {
  groqInstance = null;
}

/**
 * Get or create the Groq instance
 */
function getGroqInstance(): Groq | null {
  if (groqInstance) return groqInstance;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  groqInstance = new Groq({ apiKey });
  return groqInstance;
}

/**
 * Check if Groq API is configured (has API key)
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
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
 * Groq uses OpenAI-compatible API, so message format is the same.
 */
export async function groqChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const groq = getGroqInstance();

  if (!groq) {
    return {
      success: false,
      content: '',
      error: 'GROQ_API_KEY belum dikonfigurasi. Dapatkan API key gratis di https://console.groq.com',
    };
  }

  const primaryModel = getGroqModel();
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  for (const modelId of modelsToTry) {
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
          return {
            success: false,
            content: '',
            error: `Batas permintaan Groq tercapai (${modelId}). Coba lagi dalam 1 menit.`,
          };
        }

        // Bad request error
        if (message.includes('400') || message.includes('Bad Request')) {
          return {
            success: false,
            content: '',
            error: `Permintaan tidak valid. Detail: ${message.substring(0, 200)}`,
          };
        }

        // Context length exceeded
        if (message.includes('context_length') || message.includes('too many tokens')) {
          return {
            success: false,
            content: '',
            error: 'Pesan terlalu panjang untuk model ini. Coba persingkat percakapan Anda.',
          };
        }

        // For other errors, try next model if available
        if (modelsToTry.indexOf(modelId) < modelsToTry.length - 1) {
          console.warn(`[Groq] Model ${modelId} failed with unexpected error, trying next model...`);
          break;
        }

        return {
          success: false,
          content: '',
          error: `Gagal terhubung ke Groq API: ${message.substring(0, 200)}`,
        };
      }
    }
  }

  return {
    success: false,
    content: '',
    error: 'Gagal setelah beberapa percobaan ke Groq. Coba lagi nanti.',
  };
}

/**
 * Simple convenience function for single-turn chat
 */
export async function groqChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatCompletionResponse> {
  return groqChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
