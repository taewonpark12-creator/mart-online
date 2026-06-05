import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - 관리자용 전단지 목록 조회
export async function GET() {
  try {
    const flyers = await prisma.flyer.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(flyers);
  } catch (error) {
    console.error("전단지 조회 오류:", error);
    return NextResponse.json({ error: "전단지 조회 실패" }, { status: 500 });
  }
}

// POST - 전단지 이미지 업로드
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다" }, { status: 400 });
    }

    // 현재 가장 높은 order 값 찾기
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
    console.error("전단지 업로드 오류:", error);
    return NextResponse.json({ error: "전단지 업로드 실패" }, { status: 500 });
  }
}
