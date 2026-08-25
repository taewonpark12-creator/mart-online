import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput, validateAmount } from "@/lib/security";
import { findProductsForAdmin, serializeProduct } from "@/lib/product-query";

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = sanitizeInput(searchParams.get("category") ?? "");
    const q = (searchParams.get("q")?.trim() ?? "").slice(0, 100);
    const page = toNonNegativeInt(searchParams.get("page"), 1);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const recommendedOnly = searchParams.get("recommended") === "true";
    const excludeRecommended = searchParams.get("excludeRecommended") === "true";
    const popularOnly = searchParams.get("popular") === "true";
    const onlineExclusiveOnly = searchParams.get("onlineExclusive") === "true";
    const outOfStockOnly = searchParams.get("outOfStock") === "true";
    const includeOutOfStock = searchParams.get("includeOutOfStock") === "true";

    const result = await findProductsForAdmin({
      category,
      q,
      activeOnly,
      recommendedOnly,
      excludeRecommended,
      popularOnly,
      onlineExclusiveOnly,
      outOfStockOnly,
      includeOutOfStock,
      page,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin Products API Error:", error);
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
