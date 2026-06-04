import { NextResponse } from "next/server";

const NAVER_CLIENT_ID = "5CTXJMXh6ZfTnjgxw5og";
const NAVER_CLIENT_SECRET = "Pmg86kSmBd";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "검색어가 없습니다." },
      { status: 400 }
    );
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
      query
    )}&display=10&sort=sim`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("네이버 API 실패:", errorText);

      return NextResponse.json(
        {
          error: "네이버 API 실패",
          detail: errorText,
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    const images =
      data?.items
        ?.map((item: any) => item.image)
        .filter((img: string) => img && img.startsWith("http")) || [];

    // 👉 핵심 개선: 가장 좋은 이미지 1개만 선택
    const bestImage = images[0] || null;

    return NextResponse.json({
      success: true,
      query,
      image: bestImage,
      images: images.slice(0, 5),
      count: images.length,
    });
  } catch (error) {
    console.error("이미지 검색 에러:", error);

    return NextResponse.json(
      {
        error: "서버 오류",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}