import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * ZAI API Proxy Route (Legacy - kept for backward compatibility)
 *
 * NOTE: The main AI features now use Hugging Face Inference API via @huggingface/inference.
 * This proxy route is kept as a fallback for local development only.
 *
 * Configuration is read from:
 * 1. Environment variables (ZAI_BASE_URL, ZAI_API_KEY, etc.)
 * 2. /etc/.z-ai-config file (fallback for local dev)
 */

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

function loadZAIConfig(): ZAIConfig | null {
  // Try environment variables first
  const envBaseUrl = process.env.ZAI_BASE_URL;
  const envApiKey = process.env.ZAI_API_KEY;
  if (envBaseUrl && envApiKey) {
    return {
      baseUrl: envBaseUrl,
      apiKey: envApiKey,
      chatId: process.env.ZAI_CHAT_ID,
      userId: process.env.ZAI_USER_ID,
      token: process.env.ZAI_TOKEN,
    };
  }

  // Try reading from config file (local dev)
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const configPath of configPaths) {
    try {
      const configStr = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        return config as ZAIConfig;
      }
    } catch {
      // File doesn't exist or can't be parsed, try next
    }
  }

  return null;
}

let cachedConfig: ZAIConfig | null = null;
let cachedConfigTime = 0;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getConfig(): ZAIConfig | null {
  // Invalidate cache after 5 minutes to pick up config changes
  if (cachedConfig && Date.now() - cachedConfigTime < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  cachedConfig = loadZAIConfig();
  cachedConfigTime = Date.now();
  return cachedConfig;
}

export async function POST(request: NextRequest) {
  try {
    const config = getConfig();

    if (!config) {
      return NextResponse.json(
        {
          error: 'ZAI API configuration not found',
          detail: 'Set ZAI_BASE_URL and ZAI_API_KEY environment variables, or create .z-ai-config file.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const targetUrl = `${config.baseUrl}/chat/completions`;

    // Build headers from config
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Z-AI-From': 'Z',
    };

    if (config.chatId) headers['X-Chat-Id'] = config.chatId;
    if (config.userId) headers['X-User-Id'] = config.userId;
    if (config.token) headers['X-Token'] = config.token;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('ZAI Proxy error:', msg);
    return NextResponse.json(
      { error: 'ZAI Proxy error', detail: msg },
      { status: 502 }
    );
  }
}

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic';
