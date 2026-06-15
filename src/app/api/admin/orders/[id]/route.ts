import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "PAID", "FAILED", "CANCELED"];

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

    if (!canTransition(existing.status as OrderStatus, status)) {
      return NextResponse.json(
        {
          code: "INVALID_STATUS_TRANSITION",
          error: getTransitionError(existing.status as OrderStatus, status),
        },
        { status: 400 },
      );
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
