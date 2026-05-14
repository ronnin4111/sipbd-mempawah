import { NextRequest, NextResponse } from "next/server";
import { listDocuments, getKnowledgeBaseStats } from "@/lib/knowledge-base";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const includeStats = searchParams.get("stats") === "true";

    const [documents, stats] = await Promise.all([
      listDocuments(category),
      includeStats ? getKnowledgeBaseStats() : null,
    ]);

    return NextResponse.json({
      success: true,
      data: documents,
      stats,
    });
  } catch (error: any) {
    console.error("KB list error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil daftar dokumen" },
      { status: 500 }
    );
  }
}
