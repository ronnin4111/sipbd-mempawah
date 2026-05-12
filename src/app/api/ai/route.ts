import { NextResponse } from 'next/server';
import { isGeminiConfigured, getGeminiModel } from '@/lib/gemini-ai';

export async function GET() {
  const geminiReady = isGeminiConfigured();

  return NextResponse.json({
    status: geminiReady ? 'configured' : 'fallback',
    service: 'SIPBD AI Chat',
    version: '2.1',
    providers: {
      primary: {
        name: 'Google Gemini',
        configured: geminiReady,
        model: geminiReady ? getGeminiModel() : 'not configured',
        freeTierLimits: 'gemini-2.0-flash-lite: 30 RPM, 1500 RPD',
      },
      fallback: {
        name: 'z-ai-web-dev-sdk',
        note: 'Available in sandbox/local dev only',
      },
    },
    optimizations: [
      'Smart context: only sends relevant data based on question type',
      'Compact format: group/farmer data in one-line summaries',
      'Token budget: ~4000 tokens max per request',
      'Retry logic: 2 retries with exponential backoff on rate limits',
    ],
    help: !geminiReady
      ? 'Set GEMINI_API_KEY for Google Gemini (free, https://aistudio.google.com/apikey)'
      : undefined,
  });
}
