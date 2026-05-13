/**
 * Hugging Face Inference API Client
 *
 * Uses the official @huggingface/inference SDK for reliable API access.
 * This works on both local dev and Vercel deployment.
 *
 * Environment variables:
 * - HF_API_KEY: Your Hugging Face API token (required)
 * - HF_MODEL: Model ID to use (default: Qwen/Qwen2.5-7B-Instruct)
 */

import { HfInference } from '@huggingface/inference';

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

const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

// Singleton instance
let hfInstance: HfInference | null = null;

/**
 * Get or create the HfInference instance
 */
function getHfInstance(): HfInference | null {
  if (hfInstance) return hfInstance;

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) return null;

  hfInstance = new HfInference(apiKey);
  return hfInstance;
}

/**
 * Check if Hugging Face API is configured (has API key)
 */
export function isHfConfigured(): boolean {
  return !!process.env.HF_API_KEY;
}

/**
 * Get the configured model ID
 */
export function getHfModel(): string {
  return process.env.HF_MODEL || DEFAULT_MODEL;
}

/**
 * Call the Hugging Face Inference API for chat completions.
 * Uses the official @huggingface/inference SDK which handles
 * routing to the correct provider automatically.
 */
export async function hfChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const hf = getHfInstance();

  if (!hf) {
    return {
      success: false,
      content: '',
      error: 'HF_API_KEY belum dikonfigurasi. Silakan set environment variable HF_API_KEY dengan token Hugging Face Anda.',
    };
  }

  const model = getHfModel();

  try {
    const response = await hf.chatCompletion({
      model,
      messages: options.messages,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: options.max_tokens ?? DEFAULT_MAX_TOKENS,
      top_p: options.top_p ?? 0.95,
    });

    const content = response.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content,
      model: response.model || model,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            completion_tokens: response.usage.completion_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('HF Chat Completion error:', message);

    // Handle specific HF errors
    if (message.includes('401') || message.includes('Unauthorized')) {
      return {
        success: false,
        content: '',
        error: 'Token Hugging Face tidak valid. Periksa HF_API_KEY Anda.',
      };
    }

    if (message.includes('429') || message.includes('Rate limit')) {
      return {
        success: false,
        content: '',
        error: 'Rate limit tercapai. Silakan tunggu beberapa saat dan coba lagi.',
      };
    }

    if (message.includes('503') || message.includes('loading') || message.includes('Model is currently loading')) {
      return {
        success: false,
        content: '',
        error: 'Model sedang loading. Silakan coba lagi dalam beberapa detik.',
      };
    }

    return {
      success: false,
      content: '',
      error: `Gagal terhubung ke Hugging Face API: ${message}`,
    };
  }
}

/**
 * Simple convenience function for single-turn chat
 */
export async function hfChat(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatCompletionResponse> {
  return hfChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    ...options,
  });
}
