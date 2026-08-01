import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = sanitizeInput(searchParams.get("query") ?? "").slice(0, 100);

  if (!query) {
    return NextResponse.json({ error: "검색어가 없습니다." }, { status: 400 });
  }

  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.error("Google Search API credentials not configured");
    return NextResponse.json({ error: "이미지 검색 설정이 필요합니다." }, { status: 500 });
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("Google image search failed:", response.status);
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
