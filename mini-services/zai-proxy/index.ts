/**
 * ZAI API Proxy Mini-Service
 * Port: 3050
 * Forwards requests to internal ZAI API
 * Set ZAI_API_BASE_URL environment variable (e.g. http://172.25.136.193:8080)
 */

const ZAI_API_BASE = process.env.ZAI_API_BASE_URL || 'http://localhost:8080';
const PORT = 3050;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'zai-proxy' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward all requests to ZAI API
    const targetUrl = `${ZAI_API_BASE}${url.pathname}${url.search}`;

    try {
      // Build clean headers - only forward relevant ones
      const forwardHeaders: Record<string, string> = {
        'Content-Type': req.headers.get('content-type') || 'application/json',
      };

      const optionalHeaders = ['authorization', 'x-z-ai-from', 'x-chat-id', 'x-token', 'x-user-id'];
      optionalHeaders.forEach(h => {
        const val = req.headers.get(h);
        if (val) forwardHeaders[h] = val;
      });

      let body: string | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await req.text();
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: body || undefined,
      });

      // Read the full response body as text to avoid streaming issues
      const contentType = response.headers.get('content-type') || 'application/json';
      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        headers: { 'Content-Type': contentType },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Proxy error:', msg);
      return new Response(JSON.stringify({ error: 'Proxy error', detail: msg }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
});

console.log(`ZAI Proxy running on port ${PORT}`);
console.log(`Forwarding to ${ZAI_API_BASE}`);
