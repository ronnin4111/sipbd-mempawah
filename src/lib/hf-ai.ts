/**
 * Hugging Face Inference API Client
 *
 * Uses the OpenAI-compatible endpoint for chat completions:
 * https://api-inference.huggingface.co/v1/chat/completions
 *
 * Environment variables:
 * - HF_API_KEY: Your Hugging Face API token (required)
 * - HF_MODEL: Model ID to use (default: mistralai/Mistral-7B-Instruct-v0.3)
 * - HF_BASE_URL: Custom base URL (default: https://api-inference.huggingface.co)
 */

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

const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';
const DEFAULT_BASE_URL = 'https://api-inference.huggingface.co';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

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
 *
 * Uses the OpenAI-compatible endpoint, so the message format
 * is exactly the same as OpenAI's Chat API.
 */
export async function hfChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.HF_API_KEY;
  const model = getHfModel();
  const baseUrl = process.env.HF_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      error: 'HF_API_KEY belum dikonfigurasi. Silakan set environment variable HF_API_KEY dengan token Hugging Face Anda.',
    };
  }

  const url = `${baseUrl}/v1/chat/completions`;

  const body = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: options.max_tokens ?? DEFAULT_MAX_TOKENS,
    top_p: options.top_p ?? 0.95,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = errorData.error || errorData.message || errorDetail;
      } catch {
        // Use default error message
      }

      // Handle specific HF errors
      if (response.status === 401) {
        return {
          success: false,
          content: '',
          error: 'Token Hugging Face tidak valid. Periksa HF_API_KEY Anda.',
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          content: '',
          error: 'Rate limit tercapai. Silakan tunggu beberapa saat dan coba lagi.',
        };
      }

      if (response.status === 503) {
        return {
          success: false,
          content: '',
          error: 'Model sedang loading. Silakan coba lagi dalam beberapa detik.',
        };
      }

      return {
        success: false,
        content: '',
        error: `Hugging Face API error: ${errorDetail}`,
      };
    }

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens || 0,
          completion_tokens: data.usage.completion_tokens || 0,
          total_tokens: data.usage.total_tokens || 0,
        }
      : undefined;

    return {
      success: true,
      content,
      model: data.model || model,
      usage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('HF Chat Completion error:', message);
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
