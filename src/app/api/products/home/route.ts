import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHomeProductCollections, serializeProduct } from "@/lib/product-query";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isOutOfStock: false,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        category: true,
        imageUrl: true,
        isRecommended: true,
        isOnlineExclusive: true,
        isPopular: true,
        isOutOfStock: true,
        recommendedOrder: true,
        popularOrder: true,
        maxOrderQuantity: true,
      },
    });

    const serializedProducts = products.map(serializeProduct);

    return NextResponse.json(getHomeProductCollections(serializedProducts));
  } catch (error) {
    console.error("Products Home API Error:", error);
    return NextResponse.json(
      {
        products: [],
        recommendedProducts: [],
        popularProducts: [],
        onlineExclusiveProducts: [],
        error: "홈 상품 목록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
