import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sanitizeInput, validateAmount } from "@/lib/security";
import { findProducts, serializeProduct } from "@/lib/product-query";

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

export async function GET(req: NextRequest) {
  try {
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
    const requiresAdmin = !activeOnly || outOfStockOnly || includeOutOfStock;

    if (requiresAdmin && !(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const result = await findProducts({
      category,
      q,
      activeOnly,
      recommendedOnly,
      excludeRecommended,
      popularOnly,
      onlineExclusiveOnly,
      outOfStockOnly,
      includeOutOfStock,
      customerSearchFieldsOnly: !requiresAdmin,
      page,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Products API Error:", error);
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = sanitizeInput(String(body.name ?? ""));
    const description = body.description == null ? null : sanitizeInput(String(body.description));
    const barcode = sanitizeInput(String(body.barcode ?? ""));
    const category = sanitizeInput(String(body.category ?? ""));
    const imageUrl = sanitizeInput(String(body.imageUrl ?? ""));
    const price = Number(body.price);
    const stock = toNonNegativeInt(body.stock);
    const maxOrderQuantity = toNonNegativeInt(body.maxOrderQuantity, 0);

    if (name.length > 100 || !category || !validateAmount(price)) {
      return NextResponse.json(
        { error: "가격, 카테고리를 올바르게 입력해 주세요." },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        barcode: barcode || null,
        price,
        category,
        imageUrl: imageUrl || null,
        stock,
        isRecommended: Boolean(body.isRecommended),
        isOnlineExclusive: Boolean(body.isOnlineExclusive),
        isPopular: Boolean(body.isPopular),
        isOutOfStock: Boolean(body.isOutOfStock),
        maxOrderQuantity: maxOrderQuantity > 0 ? maxOrderQuantity : null,
      },
    });

    await createAuditLog({
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      changes: { name, price, category },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json(serializeProduct(product), { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json({ error: "상품 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
