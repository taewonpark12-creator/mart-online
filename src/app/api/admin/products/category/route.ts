import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { PRODUCT_CATEGORIES } from "@/lib/types";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids = body.ids;
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "변경할 상품을 선택해 주세요." }, { status: 400 });
    }

    if (!category || !(PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: "올바른 카테고리를 선택해 주세요." }, { status: 400 });
    }

    const uniqueIds = [
      ...new Set(
        ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ];

    const result = await prisma.product.updateMany({
      where: { id: { in: uniqueIds } },
      data: { category },
    });

    return NextResponse.json({
      updatedCount: result.count,
      category,
    });
  } catch (error) {
    console.error("[POST /api/admin/products/category]", error);
    return NextResponse.json({ error: "카테고리 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
