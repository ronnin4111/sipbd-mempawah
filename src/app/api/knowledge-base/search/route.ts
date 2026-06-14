import { NextRequest, NextResponse } from "next/server";
import { searchKnowledgeBase } from "@/lib/knowledge-base";
import { ensureTablesExist } from "@/lib/db-init";

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const maxResults = parseInt(searchParams.get("max") || "5", 10);

    if (!query.trim()) {
      return NextResponse.json({ error: "Query diperlukan" }, { status: 400 });
    }

    const results = await searchKnowledgeBase(query, maxResults);
    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("KB search error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mencari di basis pengetahuan" },
      { status: 500 }
    );
  }
}
