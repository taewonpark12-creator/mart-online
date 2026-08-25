import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput, validateAmount } from "@/lib/security";
import { findProductsForAdmin, serializeProduct } from "@/lib/product-query";

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

async function getPricesJson(): Promise<Array<{ barcode: string; name: string }>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/prices.json`, { cache: 'no-store' });
    if (!response.ok) return [];
    const prices = await response.json();
    if (!Array.isArray(prices)) return [];
    return prices.map((p: any) => ({
      barcode: String(p.barcode || ''),
      name: String(p.name || ''),
    })).filter(p => p.barcode && p.name);
  } catch (error) {
    console.error('prices.json load error:', error);
    return [];
  }
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

    let result = await findProductsForAdmin({
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

    // 검색어가 있는 경우 prices.json의 이름도 검색 대상에 포함
    if (q && result.products.length === 0) {
      const prices = await getPricesJson();
      const matchedBarcodes = prices
        .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
        .map(p => p.barcode);

      if (matchedBarcodes.length > 0) {
        const priceMatchedProducts = await prisma.product.findMany({
          where: {
            barcode: { in: matchedBarcodes },
            ...(activeOnly ? { isActive: true } : {}),
            ...(outOfStockOnly ? { isOutOfStock: true } : {}),
            ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
            ...(category && category !== "전체" ? { category } : {}),
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
          take: 100,
        });

        result = {
          products: priceMatchedProducts.map(serializeProduct),
          hasMore: false,
          total: priceMatchedProducts.length,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin Products API Error:", error);
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
