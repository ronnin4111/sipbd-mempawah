import { NextRequest, NextResponse } from 'next/server';

/**
 * ZAI API Proxy Route
 *
 * This route proxies requests to the ZAI API.
 * - On local dev: forwards to 172.25.136.193:8080 (internal ZAI API)
 * - On Vercel: forwards to ZAI_PROXY_URL env var (must be set to a public proxy)
 *
 * The z-ai-web-dev-sdk reads config from a file, which doesn't exist on Vercel.
 * This proxy route allows the AI features to work on both environments.
 */

const INTERNAL_ZAI_BASE = 'http://172.25.136.193:8080';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Determine the ZAI API base URL
    const zaiBase = process.env.ZAI_PROXY_URL || INTERNAL_ZAI_BASE;
    const targetUrl = `${zaiBase}/v1/chat/completions`;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZAI_API_KEY || 'Z.ai'}`,
      'X-Z-AI-From': 'Z',
    };

    if (process.env.ZAI_CHAT_ID) headers['X-Chat-Id'] = process.env.ZAI_CHAT_ID;
    if (process.env.ZAI_USER_ID) headers['X-User-Id'] = process.env.ZAI_USER_ID;
    if (process.env.ZAI_TOKEN) headers['X-Token'] = process.env.ZAI_TOKEN;

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
