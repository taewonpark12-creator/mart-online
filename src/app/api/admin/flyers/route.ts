import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

function isSafeImageUrl(imageUrl: string): boolean {
  return (
    imageUrl.startsWith("/") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("http://")
  );
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const flyers = await prisma.flyer.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(flyers);
  } catch (error) {
    console.error("[GET /api/admin/flyers]", error);
    return NextResponse.json({ error: "전단지 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const imageUrl = sanitizeInput(String(body?.imageUrl ?? "")).slice(0, 500);

    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json({ error: "올바른 이미지 URL이 필요합니다." }, { status: 400 });
    }

    const maxOrderFlyer = await prisma.flyer.findFirst({
      orderBy: { order: "desc" },
    });

    const newOrder = maxOrderFlyer ? maxOrderFlyer.order + 1 : 0;

    const flyer = await prisma.flyer.create({
      data: {
        imageUrl,
        order: newOrder,
      },
    });

    return NextResponse.json(flyer);
  } catch (error) {
    console.error("[POST /api/admin/flyers]", error);
    return NextResponse.json({ error: "전단지 업로드에 실패했습니다." }, { status: 500 });
  }
}
