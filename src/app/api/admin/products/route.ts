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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lovemart.kr';
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
    const category = sanitizeInput(searchParams.get("category") ?? "").trim();
    const q = (searchParams.get("q")?.trim() ?? "").slice(0, 100);
    const page = toNonNegativeInt(searchParams.get("page"), 1);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const recommendedOnly = searchParams.get("recommended") === "true";
    const excludeRecommended = searchParams.get("excludeRecommended") === "true";
    const popularOnly = searchParams.get("popular") === "true";
    const onlineExclusiveOnly = searchParams.get("onlineExclusive") === "true";
    const outOfStockOnly = searchParams.get("outOfStock") === "true";
    const includeOutOfStock = searchParams.get("includeOutOfStock") === "true";

    console.log('[DEBUG] API Parameters:', {
      category,
      q,
      page,
      activeOnly,
      recommendedOnly,
      excludeRecommended,
      popularOnly,
      onlineExclusiveOnly,
      outOfStockOnly,
      includeOutOfStock,
    });

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

    console.log('[DEBUG] Query Result:', {
      total: result.total,
      hasMore: result.hasMore,
      productCount: result.products.length,
    });

    // Check if 포도 and 찰옥수수 are in the result
    const 포도InResult = result.products.some(p => p.name.includes('포도'));
    const 찰옥수수InResult = result.products.some(p => p.name.includes('찰옥수수'));
    console.log('[DEBUG] Problematic products in result:', {
      포도: 포도InResult,
      찰옥수수: 찰옥수수InResult,
    });

    // Check actual DB values of problematic products
    const problematicProducts = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: '포도' } },
          { name: { contains: '찰옥수수' } },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        isActive: true,
        isOutOfStock: true,
        isRecommended: true,
        isPopular: true,
        isOnlineExclusive: true,
      },
    });

    console.log('[DEBUG] Problematic products in DB:', JSON.stringify(problematicProducts, null, 2));

    // Compare: Query with category only vs query without category
    if (category && category !== "전체") {
      const withCategory = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: '포도' } },
            { name: { contains: '찰옥수수' } },
          ],
          category: category,
          ...(activeOnly ? { isActive: true } : {}),
          ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
        },
        select: {
          id: true,
          name: true,
          category: true,
          isActive: true,
          isOutOfStock: true,
        },
      });

      const withoutCategory = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: '포도' } },
            { name: { contains: '찰옥수수' } },
          ],
          ...(activeOnly ? { isActive: true } : {}),
          ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
        },
        select: {
          id: true,
          name: true,
          category: true,
          isActive: true,
          isOutOfStock: true,
        },
      });

      console.log('[DEBUG] Comparison - With category filter:', JSON.stringify(withCategory, null, 2));
      console.log('[DEBUG] Comparison - Without category filter:', JSON.stringify(withoutCategory, null, 2));
    }

    // 검색어가 있는 경우 prices.json의 이름도 검색 대상에 포함
    if (q) {
      const prices = await getPricesJson();
      const matchedBarcodes = prices
        .filter(p => p.name && p.name.toLowerCase().includes(q.toLowerCase()))
        .map(p => p.barcode);

      if (matchedBarcodes.length > 0) {
        const priceMatchedProducts = await prisma.product.findMany({
          where: {
            barcode: { in: matchedBarcodes },
            ...(activeOnly ? { isActive: true } : {}),
            ...(recommendedOnly ? { isRecommended: true } : {}),
            ...(excludeRecommended ? { isRecommended: false } : {}),
            ...(popularOnly ? { isPopular: true } : {}),
            ...(onlineExclusiveOnly ? { isOnlineExclusive: true } : {}),
            ...(outOfStockOnly ? { isOutOfStock: true } : {}),
            ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
            ...(category && category !== "전체" ? { category } : {}),
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
          take: 100,
        });

        // DB 검색 결과와 prices.json 검색 결과 병합 (barcode 기준 중복 제거)
        const dbBarcodes = new Set(result.products.map(p => p.barcode));
        const newProducts = priceMatchedProducts
          .filter(p => !dbBarcodes.has(p.barcode))
          .map(serializeProduct);

        const mergedProducts = [...result.products, ...newProducts];

        result = {
          products: mergedProducts,
          hasMore: false,
          total: mergedProducts.length,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin Products API Error:", error);
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
