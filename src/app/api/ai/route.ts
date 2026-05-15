import { NextResponse } from 'next/server';
import { getAIProviderStatusAsync } from '@/lib/ai-sdk';

export async function GET() {
  const status = await getAIProviderStatusAsync();

  const anyReady = status.zai.available || status.gemini.configured || status.groq.configured;

  return NextResponse.json({
    status: anyReady ? 'configured' : 'no-provider',
    service: 'SIPBD AI Chat',
    version: '4.0',
    providers: {
      primary: {
        name: 'Z.AI (chat.z.ai)',
        available: status.zai.available,
        model: status.zai.available ? status.zai.model : 'not available',
        priority: 1,
        note: 'Always available in sandbox/dev — no API key needed!',
        getUrl: 'https://chat.z.ai',
      },
      fallback1: {
        name: 'Google Gemini',
        configured: status.gemini.configured,
        model: status.gemini.configured ? status.gemini.model : 'not configured',
        priority: 2,
        freeTierLimits: 'gemini-2.0-flash: 15 RPM, 1500 RPD',
        getUrl: 'https://aistudio.google.com/apikey',
      },
      fallback2: {
        name: 'Groq',
        configured: status.groq.configured,
        model: status.groq.configured ? status.groq.model : 'not configured',
        priority: 3,
        freeTierLimits: 'llama-3.3-70b-versatile: 30 RPM, 6000 RPD',
        getUrl: 'https://console.groq.com',
      },
    },
    fallbackChain: [
      status.zai.available ? `1. Z.AI (${status.zai.model}) ✅` : '1. Z.AI (not available)',
      status.gemini.configured ? `2. Google Gemini (${status.gemini.model})` : '2. Google Gemini (not configured)',
      status.groq.configured ? `3. Groq (${status.groq.model})` : '3. Groq (not configured)',
    ],
    optimizations: [
      'Smart context: only sends relevant data based on question type',
      'Compact format: group/farmer data in one-line summaries',
      'Token budget: ~4000-6000 tokens max per request',
      'Retry logic: retries with exponential backoff on rate limits',
      'Multi-model fallback: tries alternative models within each provider',
      'Multi-provider fallback: auto-switches Z.AI → Gemini → Groq',
      'Z.AI as primary: no API key needed, works out of the box',
    ],
    help: !anyReady
      ? 'Z.AI seharusnya tersedia otomatis. Jika tidak, konfigurasi API key Gemini/Groq via Settings di chat AI.'
      : undefined,
  });
}
