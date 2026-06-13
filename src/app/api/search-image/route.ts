import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "5CTXJMXh6ZfTnjgxw5og";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "Pmg86kSmBd";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = sanitizeInput(searchParams.get("query") ?? "").slice(0, 100);

  if (!query) {
    return NextResponse.json({ error: "검색어가 없습니다." }, { status: 400 });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
      query,
    )}&display=10&sort=sim`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
    });

    if (!response.ok) {
      console.error("Naver image search failed:", response.status);
      return NextResponse.json({ error: "이미지 검색에 실패했습니다." }, { status: 500 });
    }

    const data = await response.json();
    const images =
      data?.items
        ?.map((item: { image?: unknown }) => item.image)
        .filter((img: unknown): img is string => typeof img === "string" && img.startsWith("http")) || [];

    return NextResponse.json({
      success: true,
      query,
      image: images[0] || null,
      images: images.slice(0, 5),
      count: images.length,
    });
  } catch (error) {
    console.error("Image search error:", error);
    return NextResponse.json({ error: "이미지 검색 중 오류가 발생했습니다." }, { status: 500 });
  }
}
