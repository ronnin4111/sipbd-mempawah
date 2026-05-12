/**
 * Google Gemini AI Client
 *
 * Uses the official @google/generative-ai SDK for reliable API access.
 * Works on both local dev and Vercel deployment.
 *
 * Google Gemini Free Tier (very generous):
 * - Gemini 2.0 Flash: 15 RPM, 1M tokens/min, 1500 RPD
 * - No monthly credit limits like Hugging Face
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

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

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
 * Call the Google Gemini API for chat completions.
 *
 * Gemini doesn't natively support "system" role in the same way,
 * so we prepend system messages as the first user message with a clear delimiter.
 * However, newer Gemini models support systemInstruction natively.
 */
export async function geminiChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const genAI = getGenAIInstance();

  if (!genAI) {
    return {
      success: false,
      content: '',
      error: 'GEMINI_API_KEY belum dikonfigurasi. Silakan set environment variable GEMINI_API_KEY dengan API key dari Google AI Studio (https://aistudio.google.com/apikey).',
    };
  }

  const modelId = getGeminiModel();

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
    // We need to build a conversation history
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
    console.error('Gemini Chat Completion error:', message);

    // Handle specific Gemini errors
    if (message.includes('API_KEY_INVALID') || message.includes('401') || message.includes('Unauthorized')) {
      return {
        success: false,
        content: '',
        error: 'API Key Google Gemini tidak valid. Periksa GEMINI_API_KEY Anda di https://aistudio.google.com/apikey.',
      };
    }

    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      return {
        success: false,
        content: '',
        error: 'Kuota Google Gemini tercapai. Free tier memiliki batas 15 request/menit. Silakan tunggu beberapa saat dan coba lagi.',
      };
    }

    if (message.includes('400') || message.includes('BAD_REQUEST')) {
      return {
        success: false,
        content: '',
        error: `Permintaan tidak valid: ${message}`,
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
      error: `Gagal terhubung ke Google Gemini API: ${message}`,
    };
  }
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
