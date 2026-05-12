import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Singleton ZAI instance — reuse across requests to avoid re-initialization
let zaiInstance: InstanceType<typeof ZAI> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Build the system prompt for the SIPBD AI assistant.
 * If statsContext is provided, it is injected as structured data context
 * so the AI can answer data-specific questions about fishery production.
 */
function buildSystemPrompt(statsContext?: Record<string, unknown>): string {
  let prompt = `You are Asisten AI Perikanan Budidaya (SIPBD AI), an expert assistant for the Dinas Pertanian Ketahanan Pangan dan Perikanan Kabupaten Mempawah, Kalimantan Barat.

Your role:
- Answer questions about fish farming (perikanan budidaya) production data in Kabupaten Mempawah
- Analyze trends, compare kecamatan, identify issues, and provide recommendations
- Respond in Bahasa Indonesia
- Be concise but informative
- Format large numbers with thousand separators using Indonesian format (e.g., 1.234.567 kg, Rp 25.000)
- When you see declining trends or underperforming areas, suggest potential actions
- If data is not available in the provided context, say so honestly and do not fabricate numbers
- When comparing data, highlight both positive and negative findings
- Suggest relevant actions when identifying issues (e.g., low production areas, declining trends, missing KUSUKA registrations)
- Use proper Indonesian terminology for fisheries terms

Key domain knowledge:
- Kabupaten Mempawah has 9 kecamatan with various fish farming activities
- Business types: Pembesaran (grow-out, measured in Kg) and Pembenihan (hatchery, measured in Ekor)
- Fish types: Mas, Nila, Lele, Patin, Jelawat, Bawal Air Tawar, Gurame, Vaname, Lainnya
- Container types: KJA (Keramba Jaring Apung), Kolam Air Tenang, Tambak, Bioflok, KJT (Keramba Jaring Tancap), Bak Semen, Bak Terpal, Kolam, Kolam Terpal, Keramba, Sawah
- RTP = Rumah Tangga Perikanan (fishery households) — indicates the number of farming households
- KUSUKA = Kartu Identitas Usaha Perikanan (fishery business ID card) — indicates formal registration
- Production value is typically measured in Rp (Rupiah)
- Key kecamatan in Mempawah: Siantan, Sengah Temila, Mempawah Hilir, Mempawah Hulu, Ledo, Toho, Mandor, Sungai Kunyit, Jawai

When analyzing data:
1. Identify the top and bottom performing kecamatan
2. Note any year-over-year trends (growth or decline)
3. Compare production volumes across fish types
4. Assess RTP distribution and KUSUKA registration rates
5. Recommend actions for improvement where needed`;

  if (statsContext && Object.keys(statsContext).length > 0) {
    prompt += `\n\n=== CURRENT DATA CONTEXT ===\nHere is the current production data for Kabupaten Mempawah that you should reference when answering questions:\n`;
    prompt += JSON.stringify(statsContext, null, 2);
    prompt += `\n\nUse this data to provide accurate, data-driven answers. When referencing specific numbers from this data, always format them with thousand separators as described above.`;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, messages = [], statsContext } = body as {
      message?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      statsContext?: Record<string, unknown>;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    const zai = await getZAI();
    const systemPrompt = buildSystemPrompt(statsContext);

    // Build conversation messages:
    // 1. System prompt with stats context as the first assistant message
    // 2. Up to last 10 messages from conversation history for context window
    // 3. The user's new message
    const chatMessages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: systemPrompt },
      ...(Array.isArray(messages)
        ? messages.slice(-10).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: String(m.content),
          }))
        : []),
      { role: 'user', content: message },
    ];

    const completion = await zai.chat.completions.create({
      messages: chatMessages,
      thinking: { type: 'disabled' },
    });

    const aiResponse =
      completion.choices[0]?.message?.content ||
      'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini. Silakan coba lagi.';

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });
  } catch (error: unknown) {
    console.error('AI Chat error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal memproses pesan AI',
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
