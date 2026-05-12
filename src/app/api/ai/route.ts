import { NextResponse } from 'next/server';
import { isGeminiConfigured, getGeminiModel } from '@/lib/gemini-ai';
import { isGroqConfigured, getGroqModel } from '@/lib/groq-ai';

export async function GET() {
  const geminiReady = isGeminiConfigured();
  const groqReady = isGroqConfigured();

  const anyReady = geminiReady || groqReady;

  return NextResponse.json({
    status: anyReady ? 'configured' : 'no-provider',
    service: 'SIPBD AI Chat',
    version: '3.0',
    providers: {
      primary: {
        name: 'Google Gemini',
        configured: geminiReady,
        model: geminiReady ? getGeminiModel() : 'not configured',
        freeTierLimits: 'gemini-2.0-flash: 15 RPM, 1500 RPD',
        getUrl: 'https://aistudio.google.com/apikey',
      },
      fallback1: {
        name: 'Groq',
        configured: groqReady,
        model: groqReady ? getGroqModel() : 'not configured',
        freeTierLimits: 'llama-3.3-70b-versatile: 30 RPM, 6000 RPD',
        getUrl: 'https://console.groq.com',
      },
      fallback2: {
        name: 'z-ai-web-dev-sdk',
        note: 'Available in sandbox/local dev only',
      },
    },
    fallbackChain: [
      geminiReady ? `1. Google Gemini (${getGeminiModel()})` : '1. Google Gemini (not configured)',
      groqReady ? `2. Groq (${getGroqModel()})` : '2. Groq (not configured)',
      '3. z-ai (local dev only)',
    ],
    optimizations: [
      'Smart context: only sends relevant data based on question type',
      'Compact format: group/farmer data in one-line summaries',
      'Token budget: ~4000 tokens max per request',
      'Retry logic: 2 retries with exponential backoff on rate limits',
      'Multi-model fallback: tries alternative models within each provider',
      'Multi-provider fallback: auto-switches between Gemini → Groq → z-ai',
    ],
    help: !anyReady
      ? 'Set GEMINI_API_KEY (https://aistudio.google.com/apikey) dan/atau GROQ_API_KEY (https://console.groq.com) — keduanya gratis!'
      : undefined,
  });
}
