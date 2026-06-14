import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractKeywordsFromContent } from "@/lib/knowledge-base";
import { ensureTablesExist } from "@/lib/db-init";

/**
 * Re-index all existing knowledge base chunks.
 * This re-extracts keywords from content for chunks that have empty keywords.
 * Requires admin password via x-admin-password header.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();
    const password = request.headers.get("x-admin-password");

    // Verify password
    if (!password) {
      return NextResponse.json({ error: "Password admin diperlukan" }, { status: 401 });
    }

    const { verifyPassword } = await import("@/lib/passwords");
    const valid = await verifyPassword(password, "admin");
    if (!valid) {
      return NextResponse.json({ error: "Password admin tidak valid" }, { status: 401 });
    }

    // Get all chunks that have empty keywords
    const chunks = await db.knowledgeChunk.findMany({
      where: {
        OR: [
          { keywords: "" },
          { keywords: null },
        ],
      },
      include: {
        document: { select: { title: true, category: true } },
      },
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Semua chunk sudah memiliki keywords. Tidak perlu re-index.",
        updatedCount: 0,
      });
    }

    // Re-extract keywords for each chunk
    let updatedCount = 0;
    for (const chunk of chunks) {
      const keywords = extractKeywordsFromContent(chunk.content);
      await db.knowledgeChunk.update({
        where: { id: chunk.id },
        data: { keywords: keywords.join(",") },
      });
      updatedCount++;
    }

    // Also re-extract keywords for chunks that have keywords but might be outdated
    const allChunks = await db.knowledgeChunk.findMany({
      where: {
        NOT: {
          OR: [
            { keywords: "" },
            { keywords: null },
          ],
        },
      },
    });

    let refreshedCount = 0;
    for (const chunk of allChunks) {
      const existingKws = chunk.keywords ? chunk.keywords.split(",").filter(Boolean) : [];
      // Only re-extract if keywords seem too few (less than 3)
      if (existingKws.length < 3) {
        const keywords = extractKeywordsFromContent(chunk.content);
        if (keywords.length > existingKws.length) {
          await db.knowledgeChunk.update({
            where: { id: chunk.id },
            data: { keywords: keywords.join(",") },
          });
          refreshedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Re-index selesai. ${updatedCount} chunk diperbarui, ${refreshedCount} chunk diperkaya.`,
      updatedCount,
      refreshedCount,
    });
  } catch (error: any) {
    console.error("KB reindex error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal re-index basis pengetahuan" },
      { status: 500 }
    );
  }
}
