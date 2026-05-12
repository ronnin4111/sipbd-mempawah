/**
 * Google Gemini AI Client — Optimized for Free Tier
 *
 * Uses the official @google/generative-ai SDK for reliable API access.
 * Works on both local dev and Vercel deployment.
 *
 * Google Gemini Free Tier:
 * - gemini-2.0-flash: 10 RPM, 250 RPD (shared endpoint)
 * - gemini-2.0-flash-lite: 30 RPM, 1500 RPD (recommended for high usage)
 * - gemini-2.5-flash-preview-05-20: 10 RPM (preview, newest)
 *
 * IMPORTANT: Free tier limits are PER API KEY, shared across all users.
 * If your key is used elsewhere, limits may be reached faster.
 *
 * Environment variables:
 * - GEMINI_API_KEY: Your Google AI Studio API key (required)
 * - GEMINI_MODEL: Model ID to use (default: gemini-2.0-flash-lite)
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

// Use flash-lite for higher rate limits on free tier
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

// Singleton instance
let genAIInstance: GoogleGenerativeAI | null = null;

/**
 * Get or create the GoogleGenerativeAI instance
 */
function getGenAIInstance(): GoogleGenerativeAI | null {
  if (genAIInstance) return genAIInstance;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

/**
 * Check if Google Gemini API is configured (has API key)
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
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
 * Call the Google Gemini API for chat completions.
 * Includes retry logic for rate limit errors.
 */
export async function geminiChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const genAI = getGenAIInstance();

  if (!genAI) {
    return {
      success: false,
      content: '',
      error: 'GEMINI_API_KEY belum dikonfigurasi. Dapatkan API key gratis di https://aistudio.google.com/apikey',
    };
  }

  const modelId = getGeminiModel();

  // Try up to MAX_RETRIES + 1 times
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Gemini Chat Completion error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, message);

      // Check if this is a retryable error (rate limit)
      const isRateLimit = message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('rate');
      
      // If it's a rate limit error and we have retries left, wait and try again
      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Non-retryable error or out of retries — return the appropriate error
      if (message.includes('API_KEY_INVALID') || message.includes('401') || message.includes('Unauthorized') || message.includes('API key not valid')) {
        return {
          success: false,
          content: '',
          error: `API Key Gemini tidak valid. Periksa GEMINI_API_KEY Anda. Detail: ${message}`,
        };
      }

      if (isRateLimit) {
        return {
          success: false,
          content: '',
          error: `Batas permintaan Gemini tercapai (${modelId}). Coba lagi dalam 1 menit. Detail: ${message}`,
        };
      }

      if (message.includes('400') || message.includes('BAD_REQUEST')) {
        return {
          success: false,
          content: '',
          error: `Permintaan tidak valid (mungkin terlalu besar). Detail: ${message.substring(0, 200)}`,
        };
      }

      if (message.includes('SAFETY') || message.includes('blocked')) {
        return {
          success: false,
          content: '',
          error: 'Respons diblokir oleh filter keamanan Google. Coba reformulasikan pertanyaan Anda.',
        };
      }

      return {
        success: false,
        content: '',
        error: `Gagal terhubung ke Gemini API: ${message.substring(0, 200)}`,
      };
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    content: '',
    error: 'Gagal setelah beberapa percobaan. Coba lagi nanti.',
  };
}

/**
 * Simple convenience function for single-turn chat
 */
export async function geminiChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatCompletionResponse> {
  return geminiChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
