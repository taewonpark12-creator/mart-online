import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawUrl = sanitizeInput(String(body?.url ?? "")).slice(0, 1000);

    if (!rawUrl) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 });
    }

    let imageUrl: URL;
    try {
      imageUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "유효하지 않은 이미지 URL입니다." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(imageUrl.protocol) || isPrivateHost(imageUrl.hostname)) {
      return NextResponse.json({ error: "허용되지 않는 이미지 URL입니다." }, { status: 400 });
    }

    const response = await fetch(imageUrl.toString(), {
      headers: {
        "User-Agent": "mart-online-image-fetcher/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error("[POST /api/download-image] upstream failed", response.status);
      return NextResponse.json({ error: "이미지 다운로드에 실패했습니다." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일이 아닙니다." }, { status: 400 });
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: "이미지는 5MB 이하만 사용할 수 있습니다." }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: "이미지는 5MB 이하만 사용할 수 있습니다." }, { status: 400 });
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/download-image]", error);
    return NextResponse.json({ error: "이미지 다운로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
