import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteProductById } from "@/lib/product-delete";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "삭제할 상품을 선택해 주세요." }, { status: 400 });
    }

    const uniqueIds = [
      ...new Set(
        ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ];

    const results = await Promise.all(uniqueIds.map((id) => deleteProductById(id)));

    const deleted = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted: deleted.map((r) => ({ id: r.id, name: r.name })),
      failed: failed.map((r) => ({ id: r.id, name: r.name, error: r.error })),
    });
  } catch (error) {
    console.error("[POST /api/admin/products/delete]", error);
    return NextResponse.json({ error: "삭제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
