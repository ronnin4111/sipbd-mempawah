import { NextRequest, NextResponse } from "next/server";
import { deleteDocument } from "@/lib/knowledge-base";
import { verifyPassword } from "@/lib/passwords";
import { ensureTablesExist } from "@/lib/db-init";

export async function DELETE(request: NextRequest) {
  try {
    await ensureTablesExist();
    // Verify admin password
    const password = request.headers.get("x-admin-password");
    const valid = await verifyPassword(password || "", "admin");
    if (!valid) {
      return NextResponse.json({ error: "Password admin diperlukan" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json({ error: "ID dokumen diperlukan" }, { status: 400 });
    }

    const result = await deleteDocument(documentId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("KB delete error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menghapus dokumen" },
      { status: 500 }
    );
  }
}
