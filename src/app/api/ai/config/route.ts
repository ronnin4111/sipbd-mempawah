import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';
import { checkZaiAvailable } from '@/lib/ai-sdk';

// Keys stored in AppSetting table
const AI_KEY_SETTINGS = {
  geminiApiKey: 'ai_gemini_api_key',
  groqApiKey: 'ai_groq_api_key',
  geminiModel: 'ai_gemini_model',
  groqModel: 'ai_groq_model',
};

// GET /api/ai/config — check AI provider configuration status
export async function GET() {
  try {
    const results: Record<string, string | null> = {};

    for (const [name, key] of Object.entries(AI_KEY_SETTINGS)) {
      const setting = await db.appSetting.findUnique({ where: { key } });
      results[name] = setting?.value ? JSON.parse(setting.value) : null;
    }

    // Also check environment variables
    const envGeminiKey = process.env.GEMINI_API_KEY || null;
    const envGroqKey = process.env.GROQ_API_KEY || null;

    // Build status — key is "available" if either env var or DB setting exists
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
    const body = await request.json();
    const { password, geminiApiKey, groqApiKey, geminiModel, groqModel } = body;

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
