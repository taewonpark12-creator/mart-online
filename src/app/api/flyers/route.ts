import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - 활성화된 전단지 목록 조회
export async function GET() {
  try {
    const flyers = await prisma.flyer.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(flyers);
  } catch (error) {
    console.error("전단지 조회 오류:", error);
    return NextResponse.json({ error: "전단지 조회 실패" }, { status: 500 });
  }
}
