import { NextResponse } from "next/server";
import { findProducts, getHomeProductCollections } from "@/lib/product-query";

export async function GET() {
  try {
    const products = await findProducts();
    return NextResponse.json(getHomeProductCollections(products));
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
