import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";

type Params = { params: Promise<{ id: string }> };

const allowedStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

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

export async function PATCH(request: NextRequest, context: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let receivedStatus: unknown = null;

  try {
    const { id } = await context.params;
    const body = await request.json();
    receivedStatus = body.status;
    const nextStatus = String(receivedStatus) as OrderStatus;

    console.log("ORDER_STATUS_UPDATE_BODY", body);
    console.log("ORDER_STATUS_UPDATE_RECEIVED_STATUS", receivedStatus);

    if (!allowedStatuses.includes(String(receivedStatus) as OrderStatus)) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: `허용되지 않은 주문상태입니다: ${receivedStatus}`,
          receivedStatus,
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

    if (!canTransition(existing.status as OrderStatus, nextStatus)) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS_TRANSITION",
          message: getTransitionError(existing.status as OrderStatus, nextStatus),
          currentStatus: existing.status,
          requestedStatus: nextStatus,
        },
        { status: 400 },
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: nextStatus },
    });

    console.log(`[PATCH /api/admin/orders/${id}] SUCCESS: ${existing.status} -> ${nextStatus}`);
    return NextResponse.json({ order });
  } catch (error) {
    console.error("[ORDER_STATUS_UPDATE_ERROR]", error);

    return NextResponse.json(
      {
        error: "ORDER_STATUS_UPDATE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        receivedStatus,
      },
      { status: 500 },
    );
  }
}
