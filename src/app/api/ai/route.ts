import { NextResponse } from 'next/server';
import { getAIProviderStatusAsync } from '@/lib/ai-sdk';

export async function GET() {
  const status = await getAIProviderStatusAsync();

  const anyReady = status.zai.available || status.gemini.configured || status.groq.configured;

  return NextResponse.json({
    status: anyReady ? 'configured' : 'no-provider',
    service: 'SIPBD AI Chat',
    version: '4.1',
    providers: {
      primary: {
        name: 'Z.AI (api.z.ai)',
        available: status.zai.available,
        model: status.zai.available ? status.zai.model : 'not available',
        priority: 1,
        note: status.zai.available ? 'Available' : 'Set ZAI_BASE_URL=https://api.z.ai/api/v1 + ZAI_API_KEY in env vars (NOT chat.z.ai/api/v1!)',
        getUrl: 'https://chat.z.ai',
        apiBaseUrl: 'https://api.z.ai/api/v1',
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
      status.zai.available ? `1. Z.AI (${status.zai.model}) ✅` : '1. Z.AI (not configured — needs env vars)',
      status.gemini.configured ? `2. Google Gemini (${status.gemini.model})` : '2. Google Gemini (not configured)',
      status.groq.configured ? `3. Groq (${status.groq.model})` : '3. Groq (not configured)',
    ],
    vercelSetup: {
      step1: 'Go to Vercel Dashboard → Project → Settings → Environment Variables',
      step2: 'Add ZAI_BASE_URL = https://api.z.ai/api/v1 (NOT chat.z.ai/api/v1!)',
      step3: 'Add ZAI_API_KEY = (get from https://chat.z.ai → Settings → API Keys)',
      step4: 'Redeploy the project',
      alternative: 'Or configure Gemini/Groq API key for free tier fallback',
    },
    help: !anyReady
      ? 'Untuk Vercel: set ZAI_BASE_URL=https://api.z.ai/api/v1 dan ZAI_API_KEY di Environment Variables. JANGAN gunakan chat.z.ai/api/v1! Atau gunakan Gemini/Groq free tier sebagai fallback.'
      : undefined,
  });
}
