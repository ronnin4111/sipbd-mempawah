import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractKeywordsFromContent } from "@/lib/knowledge-base";
import { ensureTablesExist } from "@/lib/db-init";

/**
 * Re-index all existing knowledge base chunks.
 * This re-extracts keywords from content for chunks that have empty keywords.
 * Requires admin password via x-admin-password header.
 */

// [H-5] Batched concurrent UPDATE helper. Prisma doesn't expose a bulk
// update-by-different-values primitive, so we chunk Promise.all batches of 50
// to avoid issuing N sequential round-trips to Turso. Failures are logged
// per-item and do not abort the batch (preserves the original "best effort"
// semantics of the sequential loop).
async function batchUpdateKeywords(items: { id: string; keywords: string }[]): Promise<number> {
  let count = 0;
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const results = await Promise.all(
      batch.map(item =>
        db.knowledgeChunk
          .update({
            where: { id: item.id },
            data: { keywords: item.keywords },
          })
          .then(() => true)
          .catch(err => {
            console.error(`[reindex] update failed for ${item.id}:`, err);
            return false;
          })
      )
    );
    count += results.filter(Boolean).length;
  }
  return count;
}

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

    // Get all chunks that have empty keywords.
    // NOTE: the `keywords` column is non-nullable with @default(""), so missing
    // keywords are stored as "" (empty string), never NULL. The previous
    // `OR: [{ keywords: "" }, { keywords: null }]` form was invalid for
    // SQLite/Prisma (tsc rejected `null`) and is simplified to a single
    // equality check. We also drop the unused `include: { document }` relation
    // and project only the columns we actually use (id, content).
    const chunks = await db.knowledgeChunk.findMany({
      where: { keywords: "" },
      select: { id: true, content: true },
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Semua chunk sudah memiliki keywords. Tidak perlu re-index.",
        updatedCount: 0,
        refreshedCount: 0,
      });
    }

    // [H-5] Pre-compute keywords for all empty-keyword chunks, then issue
    // batched concurrent UPDATEs (was: N sequential awaits inside for...of).
    const toUpdate = chunks.map(c => ({
      id: c.id,
      keywords: extractKeywordsFromContent(c.content).join(","),
    }));
    const updatedCount = await batchUpdateKeywords(toUpdate);

    // Also re-extract keywords for chunks that have keywords but might be outdated.
    // Same simplification: keywords is non-nullable, so NOT { keywords: "" }
    // is equivalent to { NOT: { keywords: "" } } (previously NOT OR["", null]).
    // Project only the 3 columns actually referenced below.
    const allChunks = await db.knowledgeChunk.findMany({
      where: { NOT: { keywords: "" } },
      select: { id: true, keywords: true, content: true },
    });

    // [H-5] Filter in JS, pre-compute keywords, then batch update. Previously
    // each filtered chunk triggered an individual awaited UPDATE.
    const toRefresh = allChunks
      .map(c => {
        const existingKws = c.keywords ? c.keywords.split(",").filter(Boolean) : [];
        // Only re-extract if keywords seem too few (less than 3)
        if (existingKws.length >= 3) return null;
        const newKws = extractKeywordsFromContent(c.content);
        if (newKws.length <= existingKws.length) return null;
        return { id: c.id, keywords: newKws.join(",") };
      })
      .filter((x): x is { id: string; keywords: string } => x !== null);
    const refreshedCount = await batchUpdateKeywords(toRefresh);

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
