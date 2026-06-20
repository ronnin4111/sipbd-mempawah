import { NextResponse } from 'next/server';
import { callAI, checkZaiAvailable, getAIProviderStatusAsync } from '@/lib/ai-sdk';
import { ensureTablesExist } from '@/lib/db-init';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/test — Test all AI providers and database connection.
 * Returns detailed status for each provider with latency measurements.
 */
export async function GET() {
  const results: {
    zai: { available: boolean; testResult: string; latencyMs: number; error: string | null; model?: string };
    gemini: { keyFound: boolean; keySource: string; keyHint: string | null; testResult: string; latencyMs: number; error: string | null };
    groq: { keyFound: boolean; keySource: string; keyHint: string | null; testResult: string; latencyMs: number; error: string | null };
    dbConnection: { ok: boolean; error: string | null };
    summary: string;
  } = {
    zai: { available: false, testResult: 'not_tested', latencyMs: 0, error: null },
    gemini: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'not_tested', latencyMs: 0, error: null },
    groq: { keyFound: false, keySource: 'none', keyHint: null, testResult: 'not_tested', latencyMs: 0, error: null },
    dbConnection: { ok: false, error: null },
    summary: '',
  };

  // 1. Test Z.AI
  try {
    const zaiStart = Date.now();
    const zaiAvailable = await checkZaiAvailable();
    results.zai.available = zaiAvailable;

    if (zaiAvailable) {
      // Try a simple completion
      const zaiResult = await callAI({
        messages: [
          { role: 'system', content: 'You are a test assistant. Reply with exactly: OK' },
          { role: 'user', content: 'Test' },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      results.zai.latencyMs = Date.now() - zaiStart;

      if (zaiResult.success) {
        results.zai.testResult = 'success';
        results.zai.model = zaiResult.model;
      } else {
        results.zai.testResult = 'failed';
        results.zai.error = zaiResult.error?.substring(0, 200) || 'Unknown error';
      }
    } else {
      results.zai.testResult = 'not_configured';
      results.zai.error = 'Z.AI config not found (no env vars or .z-ai-config file)';
    }
  } catch (err) {
    results.zai.testResult = 'failed';
    results.zai.error = err instanceof Error ? err.message.substring(0, 200) : 'Unknown error';
  }

  // 2. Check Gemini key
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    let dbGeminiKey: string | null = null;
    try {
      await ensureTablesExist();
      const setting = await db.appSetting.findUnique({ where: { key: 'ai_gemini_api_key' } });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        if (typeof parsed === 'string' && parsed.trim()) dbGeminiKey = parsed.trim();
      }
    } catch { /* DB error */ }

    const effectiveGeminiKey = geminiKey || dbGeminiKey;
    results.gemini.keyFound = !!effectiveGeminiKey;
    results.gemini.keySource = geminiKey ? 'env' : dbGeminiKey ? 'database' : 'none';
    results.gemini.keyHint = effectiveGeminiKey
      ? `${effectiveGeminiKey.substring(0, 6)}...${effectiveGeminiKey.substring(effectiveGeminiKey.length - 4)}`
      : null;

    if (effectiveGeminiKey) {
      const geminiStart = Date.now();
      const geminiResult = await callAI({
        messages: [
          { role: 'system', content: 'You are a test assistant. Reply with exactly: OK' },
          { role: 'user', content: 'Test' },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      results.gemini.latencyMs = Date.now() - geminiStart;
      results.gemini.testResult = geminiResult.success ? 'success' : 'failed';
      results.gemini.error = geminiResult.success ? null : geminiResult.error?.substring(0, 200) || null;
    } else {
      results.gemini.testResult = 'not_configured';
      results.gemini.error = 'GEMINI_API_KEY not set. Get one at https://aistudio.google.com/apikey';
    }
  } catch (err) {
    results.gemini.testResult = 'failed';
    results.gemini.error = err instanceof Error ? err.message.substring(0, 200) : 'Unknown error';
  }

  // 3. Check Groq key
  try {
    const groqKey = process.env.GROQ_API_KEY;
    let dbGroqKey: string | null = null;
    try {
      await ensureTablesExist();
      const setting = await db.appSetting.findUnique({ where: { key: 'ai_groq_api_key' } });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        if (typeof parsed === 'string' && parsed.trim()) dbGroqKey = parsed.trim();
      }
    } catch { /* DB error */ }

    const effectiveGroqKey = groqKey || dbGroqKey;
    results.groq.keyFound = !!effectiveGroqKey;
    results.groq.keySource = groqKey ? 'env' : dbGroqKey ? 'database' : 'none';
    results.groq.keyHint = effectiveGroqKey
      ? `${effectiveGroqKey.substring(0, 6)}...${effectiveGroqKey.substring(effectiveGroqKey.length - 4)}`
      : null;

    if (effectiveGroqKey) {
      const groqStart = Date.now();
      const groqResult = await callAI({
        messages: [
          { role: 'system', content: 'You are a test assistant. Reply with exactly: OK' },
          { role: 'user', content: 'Test' },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      results.groq.latencyMs = Date.now() - groqStart;
      results.groq.testResult = groqResult.success ? 'success' : 'failed';
      results.groq.error = groqResult.success ? null : groqResult.error?.substring(0, 200) || null;
    } else {
      results.groq.testResult = 'not_configured';
      results.groq.error = 'GROQ_API_KEY not set. Get one at https://console.groq.com';
    }
  } catch (err) {
    results.groq.testResult = 'failed';
    results.groq.error = err instanceof Error ? err.message.substring(0, 200) : 'Unknown error';
  }

  // 4. Test database connection
  try {
    await ensureTablesExist();
    const tableCheck = await db.appSetting.count();
    results.dbConnection.ok = true;
    results.dbConnection.error = null;
    void tableCheck; // suppress unused warning
  } catch (err) {
    results.dbConnection.ok = false;
    results.dbConnection.error = err instanceof Error ? err.message.substring(0, 200) : 'Unknown DB error';
  }

  // 5. Summary
  const workingProviders: string[] = [];
  if (results.zai.testResult === 'success') workingProviders.push(`Z.AI (${results.zai.model || 'glm-4-plus'})`);
  if (results.gemini.testResult === 'success') workingProviders.push('Gemini');
  if (results.groq.testResult === 'success') workingProviders.push('Groq');

  if (workingProviders.length > 0) {
    results.summary = `AI berfungsi: ${workingProviders.join(', ')}`;
  } else {
    results.summary = 'Tidak ada provider AI yang aktif. Z.AI harus otomatis tersedia — periksa koneksi.';
  }

  return NextResponse.json({ results });
}
