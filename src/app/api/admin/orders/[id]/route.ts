import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "APPROVED", "DELIVERED", "CANCELLED"];

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();

    console.log(`[PATCH /api/admin/orders/${id}] status=${status}`);

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "올바르지 않은 주문 상태입니다." }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("[PATCH /api/admin/orders/[id]]", error);
    return NextResponse.json({ error: "주문 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;

    console.log(`[DELETE /api/admin/orders/${id}] Deleting order`);

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // Delete the order - OrderItems will be cascade deleted automatically due to the schema
    await prisma.order.delete({
      where: { id },
    });

    console.log(`[DELETE /api/admin/orders/${id}] Order deleted successfully`);

    return NextResponse.json({ message: "주문이 삭제되었습니다." });
  } catch (error) {
    console.error("[DELETE /api/admin/orders/[id]]", error);
    return NextResponse.json({ error: "주문 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
