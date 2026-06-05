import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PATCH - 전단지 순서 변경 또는 활성화/비활성화
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { order, isActive } = body;

    const flyer = await prisma.flyer.update({
      where: { id },
      data: {
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(flyer);
  } catch (error) {
    console.error("전단지 수정 오류:", error);
    return NextResponse.json({ error: "전단지 수정 실패" }, { status: 500 });
  }
}

// DELETE - 전단지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.flyer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("전단지 삭제 오류:", error);
    return NextResponse.json({ error: "전단지 삭제 실패" }, { status: 500 });
  }
}
