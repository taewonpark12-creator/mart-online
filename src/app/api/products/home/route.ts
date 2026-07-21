import { NextResponse } from "next/server";
import { getHomeProducts } from "@/lib/product-query";

export async function GET() {
  try {
    const homeData = await getHomeProducts();

    return NextResponse.json(homeData);
  } catch (error) {
    console.error("Products Home API Error:", error);
    return NextResponse.json(
      {
        recommendedProducts: [],
        popularProducts: [],
        onlineExclusiveProducts: [],
        error: "홈 상품 목록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
