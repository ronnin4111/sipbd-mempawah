import { NextRequest, NextResponse } from 'next/server';
import { getAllMemories, clearMemories } from '@/lib/ai-memory';

/**
 * AI Memory Management API
 * GET  — List all memories for a session
 * DELETE — Clear all memories for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || 'default';

    const memories = await getAllMemories(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      count: memories.length,
      memories: memories.map(m => ({
        id: m.id,
        category: m.category,
        key: m.key,
        value: m.value,
        context: m.context,
        confidence: m.confidence,
        source: m.source,
        accessCount: m.accessCount,
        lastAccessedAt: m.lastAccessedAt,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || 'default';

    const count = await clearMemories(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      deletedCount: count,
    });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Failed to clear memories' },
      { status: 500 }
    );
  }
}
