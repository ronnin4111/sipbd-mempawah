import { hfChatCompletion, isHfConfigured, getHfModel } from './hf-ai';

/**
 * Unified AI SDK helper.
 *
 * Strategy:
 * 1. Try Hugging Face Inference API (works everywhere — local dev AND Vercel)
 * 2. No more dependency on z-ai-web-dev-sdk for production
 *
 * The z-ai-web-dev-sdk requires a .z-ai-config file which is not available on Vercel.
 * Hugging Face API uses simple environment variables (HF_API_KEY) which work on Vercel.
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
 * Call AI using the best available provider.
 * Currently uses Hugging Face Inference API exclusively.
 */
export async function callAI(options: UnifiedAIOptions): Promise<UnifiedAIResult> {
  // Use Hugging Face API
  if (isHfConfigured()) {
    const result = await hfChatCompletion({
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    });

    return {
      success: result.success,
      content: result.content,
      error: result.error,
      provider: 'huggingface',
      model: result.model || getHfModel(),
    };
  }

  return {
    success: false,
    content: '',
    error: 'Tidak ada provider AI yang tersedia. Set HF_API_KEY environment variable.',
    provider: 'none',
  };
}

/**
 * Check if any AI provider is available
 */
export function isAIAvailable(): boolean {
  return isHfConfigured();
}
