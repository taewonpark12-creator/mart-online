import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { isAdminAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";



export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");

    const q = searchParams.get("q")?.trim() ?? "";

    const activeOnly = searchParams.get("activeOnly") !== "false";

    const recommendedOnly = searchParams.get("recommended") === "true";

    const excludeRecommended = searchParams.get("excludeRecommended") === "true";

    const outOfStockOnly = searchParams.get("outOfStock") === "true";

    const includeOutOfStock = searchParams.get("includeOutOfStock") === "true";



    const products = await prisma.product.findMany({

      where: {

        ...(activeOnly ? { isActive: true } : {}),

        ...(recommendedOnly ? { isRecommended: true } : {}),

        ...(excludeRecommended ? { isRecommended: false } : {}),

        ...(category && category !== "전체" ? { category } : {}),

        ...(outOfStockOnly ? { isOutOfStock: true } : {}),

        // 고객 페이지에서는 기본적으로 품절 상품 제외 (관리자가 포함 요청 시 제외하지 않음)
        ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),

        ...(q

          ? {

              OR: [

                { name: { contains: q } },

                { description: { contains: q } },

                { barcode: { contains: q } },

              ],

            }

          : {}),

      },

      orderBy: recommendedOnly

        ? [{ recommendedOrder: "desc" }, { name: "asc" }]

        : [{ category: "asc" }, { name: "asc" }],

    });



    // BigInt를 문자열로 변환하여 JSON 직렬화 문제 해결
    const serializedProducts = products.map((product) => ({
      ...product,
      price: product.price.toString(),
    }));

    return NextResponse.json(serializedProducts);

  } catch (error) {

    console.error("Products API Error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "상품 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );

  }

}



export async function POST(req: NextRequest) {

  try {
    if (!(await isAdminAuthenticated())) {

      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    }



    const body = await req.json();

    // [수정됨] 여기에 isRecommended와 isOnlineExclusive를 추가했습니다

    const { name, description, barcode, price, category, imageUrl, stock, isRecommended, isOnlineExclusive, isOutOfStock, maxOrderQuantity } = body;



    if (!name || !price || !category) {

      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });

    }



    const product = await prisma.product.create({

      data: {

        name,

        description: description ?? null,

        barcode: barcode?.trim() || null,

        price: Number(price),

        category,

        imageUrl: imageUrl?.trim() || null,

        stock: Number(stock) || 0,

        // [수정됨] 여기도 두 줄을 추가했습니다

        isRecommended: Boolean(isRecommended),

        isOnlineExclusive: Boolean(isOnlineExclusive),

        isOutOfStock: Boolean(isOutOfStock),

        maxOrderQuantity: maxOrderQuantity && maxOrderQuantity > 0 ? Number(maxOrderQuantity) : null,

      },

    });

    // Audit Log 기록
    await createAuditLog({
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      changes: { name, price, category },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // BigInt를 문자열로 변환하여 JSON 직렬화 문제 해결
    const serializedProduct = {
      ...product,
      price: product.price.toString(),
    };

    return NextResponse.json(serializedProduct, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "상품 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

}