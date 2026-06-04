import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids = body.ids;
    const isRecommended = Boolean(body.isRecommended);

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "상품을 선택해 주세요." }, { status: 400 });
    }

    const uniqueIds = [
      ...new Set(
        ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ];

    const result = await prisma.product.updateMany({
      where: { id: { in: uniqueIds } },
      data: { isRecommended },
    });

    return NextResponse.json({
      updatedCount: result.count,
      isRecommended,
    });
  } catch (error) {
    console.error("[POST /api/admin/products/recommended]", error);
    return NextResponse.json({ error: "추천 설정 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
