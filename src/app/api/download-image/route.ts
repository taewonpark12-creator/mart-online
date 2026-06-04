import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 });
    }

    if (!url.startsWith("http")) {
      return NextResponse.json({ error: "유효하지 않은 이미지 URL입니다." }, { status: 400 });
    }

    console.log(`이미지 다운로드 시작: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.error(`이미지 다운로드 실패: ${response.status}`);
      return NextResponse.json({ error: "이미지 다운로드 실패" }, { status: 500 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일이 아닙니다." }, { status: 400 });
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("이미지 다운로드 에러:", error);
    return NextResponse.json({ error: "이미지 다운로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
