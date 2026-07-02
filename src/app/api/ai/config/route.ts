import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';
import { verifyPassword } from '@/lib/passwords';
import { checkZaiAvailable } from '@/lib/ai-sdk';

// Keys stored in AppSetting table
const AI_KEY_SETTINGS = {
  naraApiKey: 'ai_nara_router_api_key',
  geminiApiKey: 'ai_gemini_api_key',
  groqApiKey: 'ai_groq_api_key',
  naraModel: 'ai_nara_router_model',
  geminiModel: 'ai_gemini_model',
  groqModel: 'ai_groq_model',
};

// GET /api/ai/config — check AI provider configuration status
export async function GET() {
  try {
    await ensureTablesExist();
    const results: Record<string, string | null> = {};

    // Single findMany instead of N sequential findUnique — see AUDIT-DB [Q-10]
    const settingKeys = Object.values(AI_KEY_SETTINGS);
    const settings = await db.appSetting.findMany({
      where: { key: { in: settingKeys } },
    });
    const settingByKey = settings.reduce<Record<string, string>>((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
    for (const [name, key] of Object.entries(AI_KEY_SETTINGS)) {
      const value = settingByKey[key];
      results[name] = value ? JSON.parse(value) : null;
    }

    // Also check environment variables
    const envNaraKey = process.env.NARA_ROUTER_API_KEY || null;
    const envGeminiKey = process.env.GEMINI_API_KEY || null;
    const envGroqKey = process.env.GROQ_API_KEY || null;

    // Build status — key is "available" if either env var or DB setting exists
    const naraKey = envNaraKey || results.naraApiKey;
    const geminiKey = envGeminiKey || results.geminiApiKey;
    const groqKey = envGroqKey || results.groqApiKey;

    // Check Z.AI availability
    const zaiAvailable = await checkZaiAvailable();

    return NextResponse.json({
      zai: {
        available: zaiAvailable,
        model: zaiAvailable ? 'GLM-4-Plus (auto)' : 'not available',
        note: 'Provider utama — otomatis tersedia tanpa API key',
      },
      nara: {
        configured: !!naraKey,
        source: envNaraKey ? 'env' : (results.naraApiKey ? 'database' : 'none'),
        model: results.naraModel || process.env.NARA_ROUTER_MODEL || 'mistral-large',
        keyHint: naraKey ? `${naraKey.substring(0, 8)}...${naraKey.substring(naraKey.length - 4)}` : null,
      },
      gemini: {
        configured: !!geminiKey,
        source: envGeminiKey ? 'env' : (results.geminiApiKey ? 'database' : 'none'),
        model: results.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        keyHint: geminiKey ? `${geminiKey.substring(0, 6)}...${geminiKey.substring(geminiKey.length - 4)}` : null,
      },
      groq: {
        configured: !!groqKey,
        source: envGroqKey ? 'env' : (results.groqApiKey ? 'database' : 'none'),
        model: results.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        keyHint: groqKey ? `${groqKey.substring(0, 6)}...${groqKey.substring(groqKey.length - 4)}` : null,
      },
    });
  } catch (error) {
    console.error('AI Config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI config' },
      { status: 500 }
    );
  }
}

// PUT /api/ai/config — save AI provider configuration (requires password)
export async function PUT(request: NextRequest) {
  try {
    await ensureTablesExist();
    const body = await request.json();
    const { password, naraApiKey, geminiApiKey, groqApiKey, naraModel, geminiModel, groqModel } = body;

    // Verify admin password
    if (!password) {
      return NextResponse.json({ error: 'Password diperlukan' }, { status: 401 });
    }

    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 403 });
    }

    // Save each provided setting
    const updates: string[] = [];

    if (naraApiKey !== undefined) {
      if (naraApiKey === '') {
        await db.appSetting.deleteMany({ where: { key: AI_KEY_SETTINGS.naraApiKey } });
        updates.push('naraApiKey (deleted)');
      } else {
        await db.appSetting.upsert({
          where: { key: AI_KEY_SETTINGS.naraApiKey },
          update: { value: JSON.stringify(naraApiKey) },
          create: { key: AI_KEY_SETTINGS.naraApiKey, value: JSON.stringify(naraApiKey) },
        });
        updates.push('naraApiKey');
      }
    }

    if (geminiApiKey !== undefined) {
      if (geminiApiKey === '') {
        await db.appSetting.deleteMany({ where: { key: AI_KEY_SETTINGS.geminiApiKey } });
        updates.push('geminiApiKey (deleted)');
      } else {
        await db.appSetting.upsert({
          where: { key: AI_KEY_SETTINGS.geminiApiKey },
          update: { value: JSON.stringify(geminiApiKey) },
          create: { key: AI_KEY_SETTINGS.geminiApiKey, value: JSON.stringify(geminiApiKey) },
        });
        updates.push('geminiApiKey');
      }
    }

    if (groqApiKey !== undefined) {
      if (groqApiKey === '') {
        await db.appSetting.deleteMany({ where: { key: AI_KEY_SETTINGS.groqApiKey } });
        updates.push('groqApiKey (deleted)');
      } else {
        await db.appSetting.upsert({
          where: { key: AI_KEY_SETTINGS.groqApiKey },
          update: { value: JSON.stringify(groqApiKey) },
          create: { key: AI_KEY_SETTINGS.groqApiKey, value: JSON.stringify(groqApiKey) },
        });
        updates.push('groqApiKey');
      }
    }

    if (naraModel !== undefined) {
      await db.appSetting.upsert({
        where: { key: AI_KEY_SETTINGS.naraModel },
        update: { value: JSON.stringify(naraModel) },
        create: { key: AI_KEY_SETTINGS.naraModel, value: JSON.stringify(naraModel) },
      });
      updates.push('naraModel');
    }

    if (geminiModel !== undefined) {
      await db.appSetting.upsert({
        where: { key: AI_KEY_SETTINGS.geminiModel },
        update: { value: JSON.stringify(geminiModel) },
        create: { key: AI_KEY_SETTINGS.geminiModel, value: JSON.stringify(geminiModel) },
      });
      updates.push('geminiModel');
    }

    if (groqModel !== undefined) {
      await db.appSetting.upsert({
        where: { key: AI_KEY_SETTINGS.groqModel },
        update: { value: JSON.stringify(groqModel) },
        create: { key: AI_KEY_SETTINGS.groqModel, value: JSON.stringify(groqModel) },
      });
      updates.push('groqModel');
    }

    return NextResponse.json({
      success: true,
      updated: updates,
    });
  } catch (error) {
    console.error('AI Config PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to save AI config' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
