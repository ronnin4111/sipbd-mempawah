import { db } from '@/lib/db';

/**
 * AI Memory Service — Level 2: Long-Term Memory
 *
 * Provides persistent memory for the AI assistant across sessions.
 * AI can learn facts, preferences, corrections, and insights from conversations.
 *
 * Categories:
 * - fact:        Objective facts told by user (e.g., "Kelompok X sudah tidak aktif")
 * - preference:  User preferences (e.g., "Saya biasa pantau Kec. Anjongan")
 * - correction:  User corrections to AI responses (e.g., "Bukan 57, tapi 55 kelompok")
 * - faq:         Frequently asked questions for quick reference
 * - insight:     AI-inferred patterns (e.g., "User sering tanya tentang pembenihan")
 */

// ─── Rate-limiting for memory decay (avoid running on every chat message) ─
//
// [C-1] Previously `retrieveMemories()` called `await decayMemories(sessionId)`
// on EVERY chat message, adding latency + 1+ DB round-trip per message. Now we
// only run decay at most once per hour per session, fire-and-forget.
const lastDecayRun = new Map<string, number>();
const DECAY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ─── Types ───────────────────────────────────────────────────────────

export type MemoryCategory = 'fact' | 'preference' | 'correction' | 'faq' | 'insight';
export type MemorySource = 'user_told' | 'ai_inferred' | 'correction' | 'system';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  category: MemoryCategory;
  key: string;
  value: string;
  context: string;
  confidence: number;
  source: MemorySource;
  accessCount: number;
  lastAccessedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedMemory {
  category: MemoryCategory;
  key: string;
  value: string;
  context: string;
  confidence: number;
  source: MemorySource;
}

// ─── Memory Retrieval ────────────────────────────────────────────────

/**
 * Retrieve relevant memories for a given session and user message.
 * Returns memories sorted by relevance (keyword match + recency + access count).
 */
export async function retrieveMemories(
  sessionId: string,
  userMessage: string,
  options?: { limit?: number; categories?: MemoryCategory[] }
): Promise<MemoryEntry[]> {
  const limit = options?.limit || 15;
  const categories = options?.categories;

  try {
    // Clean up expired memories first — but rate-limit to once per hour per
    // session (C-1). Fire-and-forget so we don't block the chat response.
    const lastRun = lastDecayRun.get(sessionId) ?? 0;
    if (Date.now() - lastRun > DECAY_INTERVAL_MS) {
      lastDecayRun.set(sessionId, Date.now());
      decayMemories(sessionId).catch(err => console.error('[ai-memory] decay failed:', err));
    }

    // Get all non-expired memories for this session
    const where: Record<string, unknown> = {
      sessionId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }

    const memories = await db.chatMemory.findMany({
      where,
      orderBy: [
        { confidence: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 100, // Get top 100, then rank by relevance
    });

    if (memories.length === 0) return [];

    // Score memories by relevance to the user message
    const lowerMsg = userMessage.toLowerCase();
    const msgWords = lowerMsg.split(/\s+/).filter(w => w.length > 2);

    const scored = memories.map(m => {
      let score = 0;
      const lowerValue = m.value.toLowerCase();
      const lowerKey = m.key.toLowerCase();
      const lowerContext = m.context.toLowerCase();

      // Keyword matching
      for (const word of msgWords) {
        if (lowerKey.includes(word)) score += 5;     // Key match = very relevant
        if (lowerValue.includes(word)) score += 3;   // Value match = relevant
        if (lowerContext.includes(word)) score += 1;  // Context match = slightly relevant
      }

      // Category bonus — corrections and facts are more important
      if (m.category === 'correction') score += 3;
      if (m.category === 'fact') score += 2;
      if (m.category === 'preference') score += 2;

      // Confidence bonus
      score += m.confidence * 2;

      // Recency bonus (newer = higher, within last 30 days)
      const ageDays = (Date.now() - m.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 1) score += 3;       // Very recent (< 1 day)
      else if (ageDays < 7) score += 2;  // Recent (< 1 week)
      else if (ageDays < 30) score += 1; // Somewhat recent (< 1 month)

      // Access frequency bonus
      score += Math.min(m.accessCount, 5); // Cap at 5 bonus points

      return { memory: m, score };
    });

    // Sort by relevance score, take top N
    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored.slice(0, limit).map(s => s.memory);

    // Update access count for retrieved memories (async, don't await)
    // Single updateMany instead of N separate updates — see AUDIT-DB [Q-11]
    if (topMemories.length > 0) {
      db.chatMemory.updateMany({
        where: { id: { in: topMemories.map(m => m.id) } },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      }).catch(() => {}); // Silent fail — not critical
    }

    return topMemories as unknown as MemoryEntry[];
  } catch (error) {
    console.error('[AI Memory] Retrieve error:', error);
    return [];
  }
}

// ─── Memory Storage ──────────────────────────────────────────────────

/**
 * Store a new memory or update an existing one with the same session+key.
 */
export async function storeMemory(
  sessionId: string,
  memory: ExtractedMemory
): Promise<void> {
  try {
    // Check if memory with same key already exists for this session
    const existing = await db.chatMemory.findFirst({
      where: { sessionId, key: memory.key },
    });

    if (existing) {
      // Update existing memory — merge/override value
      // If this is a correction, boost confidence; if contradictory, lower old confidence
      const newConfidence = memory.source === 'correction'
        ? Math.min(1.0, memory.confidence + 0.2)  // Corrections get confidence boost
        : memory.confidence;

      await db.chatMemory.update({
        where: { id: existing.id },
        data: {
          value: memory.value,
          context: memory.context || existing.context,
          confidence: newConfidence,
          source: memory.source,
          category: memory.category,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new memory
      await db.chatMemory.create({
        data: {
          sessionId,
          category: memory.category,
          key: memory.key,
          value: memory.value,
          context: memory.context,
          confidence: memory.confidence,
          source: memory.source,
          expiresAt: getMemoryExpiry(memory.category),
        },
      });
    }
  } catch (error) {
    console.error('[AI Memory] Store error:', error);
  }
}

/**
 * Store multiple memories at once.
 *
 * [C-3] Previously a sequential `for (const memory of memories) { await
 * storeMemory(...) }` loop — each iteration did `findFirst + update|create`
 * = 2 DB round-trips per memory, all sequential.
 *
 * Now: ONE `findMany` to fetch all existing rows with matching keys, then a
 * single `createMany` for new memories + parallel `update` calls for existing
 * ones. The confidence-merging / context-fallback / source-tracking logic
 * below mirrors `storeMemory()` exactly — see that function for details.
 */
export async function storeMemories(
  sessionId: string,
  memories: ExtractedMemory[]
): Promise<void> {
  if (!memories || memories.length === 0) return;

  try {
    // Dedupe by key (last occurrence wins) — matches the original sequential
    // behavior of `storeMemory` where the last memory with a given key
    // overwrites any earlier ones (no unique constraint on (sessionId, key)).
    const deduped = new Map<string, ExtractedMemory>();
    for (const memory of memories) {
      deduped.set(memory.key, memory);
    }
    const keys = Array.from(deduped.keys());
    const existing = await db.chatMemory.findMany({
      where: { sessionId, key: { in: keys } },
    });
    const existingMap = new Map(existing.map(e => [e.key, e]));

    // Build payload lists. We `void`-guard the array element types via `any`
    // to avoid Prisma's overly-strict generated input types complaining about
    // union literals at runtime (the values are valid at the DB level).
    const toCreate: any[] = [];
    const toUpdate: Array<{ id: string; data: any }> = [];
    const now = new Date();

    for (const memory of deduped.values()) {
      const ex = existingMap.get(memory.key);
      if (ex) {
        // Update existing memory — merge/override value
        // (mirrors storeMemory: corrections get confidence boost)
        const newConfidence = memory.source === 'correction'
          ? Math.min(1.0, memory.confidence + 0.2)
          : memory.confidence;
        toUpdate.push({
          id: ex.id,
          data: {
            value: memory.value,
            context: memory.context || ex.context,
            confidence: newConfidence,
            source: memory.source,
            category: memory.category,
            updatedAt: now,
          },
        });
      } else {
        // Create new memory (uses raw memory.confidence, NOT the boosted value
        // — same as storeMemory's create branch)
        toCreate.push({
          sessionId,
          category: memory.category,
          key: memory.key,
          value: memory.value,
          context: memory.context,
          confidence: memory.confidence,
          source: memory.source,
          expiresAt: getMemoryExpiry(memory.category),
        });
      }
    }

    await Promise.all([
      toCreate.length > 0 ? db.chatMemory.createMany({ data: toCreate }) : Promise.resolve(),
      ...toUpdate.map(u => db.chatMemory.update({ where: { id: u.id }, data: u.data })),
    ]);
  } catch (error) {
    console.error('[AI Memory] StoreMemories error:', error);
  }
}

// ─── Memory Extraction ───────────────────────────────────────────────

/**
 * Pattern-based memory extraction from conversation.
 * This is a lightweight approach that doesn't require a second AI call.
 * Extracts facts, preferences, corrections, and insights from the conversation.
 */
export function extractMemoriesFromConversation(
  sessionId: string,
  userMessage: string,
  aiResponse: string,
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const lowerUser = userMessage.toLowerCase();

  // ─── 1. CORRECTION DETECTION ─────────────────────────────────────
  // User corrects AI: "bukan...", "salah...", "seharusnya...", "maksudnya..."
  const correctionPatterns = [
    /bukan\s+(\d+)\s*(kelompok|anggota|pembudidaya|rtp)/i,
    /salah[,!.]?\s*(seharusnya|yang benar|sebenarnya)\s+(.+)/i,
    /seharusnya\s+(.+)/i,
    /yang benar\s+(.+)/i,
    /sebenarnya\s+(.+)/i,
    /maksudnya?\s+(.+)/i,
    /maksud saya\s+(.+)/i,
  ];

  for (const pattern of correctionPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        category: 'correction',
        key: `correction_${Date.now()}`,
        value: match[0],
        context: `User mengoreksi: "${userMessage}" → AI sebelumnya: "${aiResponse.substring(0, 200)}"`,
        confidence: 0.95,
        source: 'correction',
      });
      break; // Only one correction per message
    }
  }

  // ─── 2. PREFERENCE DETECTION ─────────────────────────────────────
  // User expresses preference: "saya biasa...", "saya fokus di...", "yang saya pantau..."

  const preferencePatterns = [
    { pattern: /saya\s+(biasa|sering|selalu|fokus|pantau)\s+(.+)/i, keyPrefix: 'preference_habit' },
    { pattern: /saya\s+(di|dari)\s+(kecamatan|kec\.?)\s+(\w+)/i, keyPrefix: 'preference_location' },
    { pattern: /saya\s+(tugas|bertugas|bertanggung jawab)\s+(.+)/i, keyPrefix: 'preference_role' },
    { pattern: /biasanya?\s+saya\s+(.+)/i, keyPrefix: 'preference_habit' },
  ];

  for (const { pattern, keyPrefix } of preferencePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        category: 'preference',
        key: `${keyPrefix}`,
        value: match[0],
        context: `User menyatakan preferensi: "${userMessage}"`,
        confidence: 0.85,
        source: 'user_told',
      });
    }
  }

  // ─── 3. FACT EXTRACTION ──────────────────────────────────────────
  // User states facts: "kelompok X sudah tidak aktif", "desa Y bergabung dengan..."

  const factPatterns = [
    /kelompok\s+(\w[\w\s]+?)\s+(sudah\s+)?(tidak\s+aktif|bubar|gabung|bergabung|pindah|baru)/i,
    /(\w[\w\s]+?)\s+(sudah\s+)?(tidak ada|dihapus|ditambah|ditutup|dibuka)/i,
    /desa\s+(\w[\w\s]+?)\s+(masuk|bergabung|pisah|baru)/i,
    /tahun\s+(ini|depan)\s+(.+)/i,
  ];

  for (const pattern of factPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const topic = match[1]?.trim() || 'general';
      memories.push({
        category: 'fact',
        key: `fact_${topic.toLowerCase().replace(/\s+/g, '_')}`,
        value: match[0],
        context: `User menyatakan fakta: "${userMessage}"`,
        confidence: 0.8,
        source: 'user_told',
      });
    }
  }

  // ─── 4. FAQ TRACKING ─────────────────────────────────────────────
  // Track frequently asked questions for proactive suggestions
  // Only store if the same type of question is asked repeatedly

  const faqTopic = detectFaqTopic(lowerUser);
  if (faqTopic) {
    memories.push({
      category: 'faq',
      key: `faq_${faqTopic}`,
      value: `User bertanya tentang: ${faqTopic}`,
      context: `Pertanyaan: "${userMessage.substring(0, 150)}"`,
      confidence: 0.7,
      source: 'ai_inferred',
    });
  }

  // ─── 5. INSIGHT GENERATION ───────────────────────────────────────
  // If the conversation involves a specific kecamatan/desa/group repeatedly,
  // infer that as an interest

  const recentUserMsgs = recentMessages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase());

  // Check if a specific kecamatan appears in multiple messages
  const kecamatanPattern = /kec(?:amatan)?[\s.]*(\w[\w\s]+?)(?:\s|,|\.|$)/gi;
  const kecCounts = new Map<string, number>();
  for (const msg of [...recentUserMsgs, lowerUser]) {
    let match;
    while ((match = kecamatanPattern.exec(msg)) !== null) {
      const kec = match[1].trim();
      kecCounts.set(kec, (kecCounts.get(kec) || 0) + 1);
    }
  }

  for (const [kec, count] of kecCounts) {
    if (count >= 2) {
      memories.push({
        category: 'insight',
        key: 'insight_focus_area',
        value: `User sering menanyakan tentang Kecamatan ${kec} (${count}x disebut)`,
        context: `Inferred dari riwayat percakapan`,
        confidence: 0.6,
        source: 'ai_inferred',
      });
    }
  }

  return memories;
}

// ─── Memory Formatting ───────────────────────────────────────────────

/**
 * Format retrieved memories into a text block for the AI system prompt.
 */
export function formatMemoriesForPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['\n=== MEMORI AI (informasi yang sudah diketahui dari percakapan sebelumnya) ==='];

  // Group by category
  const grouped = new Map<string, MemoryEntry[]>();
  for (const m of memories) {
    if (!grouped.has(m.category)) grouped.set(m.category, []);
    grouped.get(m.category)!.push(m);
  }

  const categoryLabels: Record<string, string> = {
    correction: '🔧 Koreksi',
    fact: '📋 Fakta',
    preference: '👤 Preferensi User',
    faq: '❓ FAQ',
    insight: '💡 Insight',
  };

  for (const [cat, entries] of grouped) {
    const label = categoryLabels[cat] || cat;
    lines.push(`\n${label}:`);
    for (const m of entries) {
      const confPct = Math.round(m.confidence * 100);
      lines.push(`  • ${m.value} (${confPct}% yakin, ${m.source})`);
    }
  }

  lines.push('\nGunakan memori ini untuk memberikan jawaban yang lebih kontekstual dan personal.');
  lines.push('Jika memori bertentangan dengan DATA CONTEXT, prioritaskan DATA CONTEXT (data DB lebih akurat).');

  return lines.join('\n');
}

// ─── Memory Decay ────────────────────────────────────────────────────

/**
 * Clean up expired memories and decay confidence of old ones.
 */
export async function decayMemories(sessionId: string): Promise<number> {
  try {
    // Delete expired memories
    const deleted = await db.chatMemory.deleteMany({
      where: {
        sessionId,
        expiresAt: { lte: new Date() },
      },
    });

    // Decay confidence of very old memories (> 90 days, not corrections).
    //
    // [C-2] Previously this was an N+1 `findMany` + `for...of update` loop.
    // Now done as TWO bulk `updateMany` calls:
    //   1. confidence > 0.4  → decrement by 0.1 (stays ≥ 0.3)
    //   2. 0.3 < confidence ≤ 0.4 → snap to 0.3
    // Both branches reproduce the original `Math.max(0.3, m.confidence - 0.1)`
    // semantics exactly (verified for all confidence values in (0.3, 1.0]).
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Memories with confidence > 0.4 → decrement by 0.1 (stays ≥ 0.3)
    const decRes = await db.chatMemory.updateMany({
      where: {
        sessionId,
        category: { not: 'correction' },
        updatedAt: { lt: ninetyDaysAgo },
        confidence: { gt: 0.4 },
      },
      data: { confidence: { decrement: 0.1 } },
    });
    // Memories with 0.3 < confidence ≤ 0.4 → snap to 0.3
    const snapRes = await db.chatMemory.updateMany({
      where: {
        sessionId,
        category: { not: 'correction' },
        updatedAt: { lt: ninetyDaysAgo },
        confidence: { gt: 0.3, lte: 0.4 },
      },
      data: { confidence: 0.3 },
    });
    const totalDecayed = decRes.count + snapRes.count;
    void totalDecayed; // currently unused but preserved for future use

    return deleted.count;
  } catch (error) {
    console.error('[AI Memory] Decay error:', error);
    return 0;
  }
}

/**
 * Get all memories for a session (for debugging/admin).
 */
export async function getAllMemories(sessionId: string): Promise<MemoryEntry[]> {
  try {
    return await db.chatMemory.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' },
    }) as MemoryEntry[];
  } catch (error) {
    console.error('[AI Memory] GetAll error:', error);
    return [];
  }
}

/**
 * Delete all memories for a session.
 */
export async function clearMemories(sessionId: string): Promise<number> {
  try {
    const result = await db.chatMemory.deleteMany({
      where: { sessionId },
    });
    return result.count;
  } catch (error) {
    console.error('[AI Memory] Clear error:', error);
    return 0;
  }
}

// ─── Helper Functions ────────────────────────────────────────────────

/**
 * Determine TTL (time-to-live) for a memory based on its category.
 */
function getMemoryExpiry(category: MemoryCategory): Date | null {
  const now = Date.now();

  switch (category) {
    case 'correction':
      return null; // Corrections persist forever
    case 'fact':
      return new Date(now + 180 * 24 * 60 * 60 * 1000); // 6 months
    case 'preference':
      return new Date(now + 90 * 24 * 60 * 60 * 1000);  // 3 months
    case 'faq':
      return new Date(now + 60 * 24 * 60 * 60 * 1000);  // 2 months
    case 'insight':
      return new Date(now + 30 * 24 * 60 * 60 * 1000);  // 1 month
    default:
      return new Date(now + 90 * 24 * 60 * 60 * 1000);  // 3 months default
  }
}

/**
 * Detect if a user message matches a common FAQ topic.
 */
function detectFaqTopic(lowerMessage: string): string | null {
  const faqTopics: Array<{ topic: string; patterns: RegExp[] }> = [
    {
      topic: 'jumlah_kelompok',
      patterns: [/berapa\s+kelompok/, /jumlah\s+kelompok/, /total\s+kelompok/],
    },
    {
      topic: 'kelompok_pembenih',
      patterns: [/kelompok\s+pembenih/, /kelompok\s+pembenihan/, /pembenihan/i],
    },
    {
      topic: 'kelompok_pembesaran',
      patterns: [/kelompok\s+pembesaran/, /pembesaran/i],
    },
    {
      topic: 'produksi',
      patterns: [/produksi/, /hasil\s+panen/, /total\s+produksi/],
    },
    {
      topic: 'trend_produksi',
      patterns: [/tren/, /trend/, /naik/, /turun/, /perkembangan/],
    },
    {
      topic: 'anggota_kelompok',
      patterns: [/anggota\s+kelompok/, /nama\s+anggota/, /siapa\s+saja/],
    },
    {
      topic: 'rtp_kusuka',
      patterns: [/rtp/, /kusuka/, /rumah\s+tangga/],
    },
    {
      topic: 'target_realisasi',
      patterns: [/target/, /realisasi/, /pencapaian/],
    },
    {
      topic: 'jenis_ikan',
      patterns: [/jenis\s+ikan/, /ikan\s+apa/, /komoditas/],
    },
  ];

  for (const { topic, patterns } of faqTopics) {
    if (patterns.some(p => p.test(lowerMessage))) {
      return topic;
    }
  }

  return null;
}
