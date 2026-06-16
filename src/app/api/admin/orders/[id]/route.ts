import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";

type Params = { params: Promise<{ id: string }> };

const allowedStatuses: OrderStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

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
    const body = await req.json();
    const { status } = body;

    console.log(`[PATCH /api/admin/orders/${id}] status=${status}`, body);

    if (!status) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: "주문 상태가 필요합니다.",
          receivedStatus: status,
          allowedStatuses,
        },
        { status: 400 },
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: `허용되지 않은 주문 상태입니다: ${status}`,
          receivedStatus: status,
          allowedStatuses,
        },
        { status: 400 },
      );
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        {
          error: "ORDER_NOT_FOUND",
          message: "주문을 찾을 수 없습니다.",
          orderId: id,
        },
        { status: 404 },
      );
    }

    if (!canTransition(existing.status as OrderStatus, status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS_TRANSITION",
          message: getTransitionError(existing.status as OrderStatus, status),
          currentStatus: existing.status,
          requestedStatus: status,
        },
        { status: 400 },
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    console.log(`[PATCH /api/admin/orders/${id}] SUCCESS: ${existing.status} -> ${status}`);
    return NextResponse.json(order);
  } catch (error) {
    console.error("[PATCH /api/admin/orders/[id]] ERROR:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "주문 상태 변경 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
