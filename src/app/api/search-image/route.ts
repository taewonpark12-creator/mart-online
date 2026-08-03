import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

const NAVER_API_HUB_CLIENT_ID = process.env.NAVER_API_HUB_CLIENT_ID;
const NAVER_API_HUB_CLIENT_SECRET = process.env.NAVER_API_HUB_CLIENT_SECRET;

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = sanitizeInput(searchParams.get("query") ?? "").slice(0, 100);

  if (!query) {
    return NextResponse.json({ error: "검색어가 없습니다." }, { status: 400 });
  }

  if (!NAVER_API_HUB_CLIENT_ID || !NAVER_API_HUB_CLIENT_SECRET) {
    console.error("NAVER API HUB credentials not configured");
    return NextResponse.json({ error: "이미지 검색 설정이 필요합니다." }, { status: 500 });
  }

  try {
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/image?query=${encodeURIComponent(query)}&display=10&format=json`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": NAVER_API_HUB_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NAVER_API_HUB_CLIENT_SECRET,
      },
    });

    if (!response.ok) {
      console.error("NAVER image search failed:", response.status);
      const errorText = await response.text();
      console.error("NAVER API HUB error response:", errorText);
      return NextResponse.json({ error: "이미지 검색에 실패했습니다." }, { status: 500 });
    }

    const data = await response.json();
    const images =
      data?.items
        ?.map((item: { link?: unknown }) => item.link)
        .filter((img: unknown): img is string => typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) || [];

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
