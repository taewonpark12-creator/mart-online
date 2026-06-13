import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const updateData: { order?: number; isActive?: boolean } = {};

    if (body?.order !== undefined) {
      const nextOrder = Number(body.order);
      if (!Number.isFinite(nextOrder) || nextOrder < 0) {
        return NextResponse.json({ error: "전단지 순서를 올바르게 입력해주세요." }, { status: 400 });
      }
      updateData.order = Math.floor(nextOrder);
    }

    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "전단지 표시 상태가 올바르지 않습니다." }, { status: 400 });
      }
      updateData.isActive = body.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
    }

    const flyer = await prisma.flyer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(flyer);
  } catch (error) {
    console.error("[PATCH /api/admin/flyers/[id]]", error);
    return NextResponse.json({ error: "전단지 수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.flyer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/flyers/[id]]", error);
    return NextResponse.json({ error: "전단지 삭제에 실패했습니다." }, { status: 500 });
  }
}
