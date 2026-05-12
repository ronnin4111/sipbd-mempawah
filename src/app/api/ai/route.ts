import { NextResponse } from 'next/server';
import { isGeminiConfigured, getGeminiModel } from '@/lib/gemini-ai';

export async function GET() {
  const geminiReady = isGeminiConfigured();
  
  return NextResponse.json({
    status: geminiReady ? 'configured' : 'fallback',
    service: 'SIPBD AI Chat',
    version: '2.0',
    providers: {
      primary: {
        name: 'Google Gemini',
        configured: geminiReady,
        model: geminiReady ? getGeminiModel() : 'not configured',
      },
      fallback: {
        name: 'z-ai-web-dev-sdk',
        note: 'Available in sandbox/local dev only',
      },
    },
    help: !geminiReady
      ? 'Set GEMINI_API_KEY for Google Gemini (free, https://aistudio.google.com/apikey). Without it, z-ai fallback is used locally.'
      : undefined,
  });
}
