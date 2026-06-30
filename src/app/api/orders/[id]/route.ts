import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "APPROVED", "DELIVERED", "CANCELLED"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    logSafeOrderEvent("admin.order.status_change.failed", {
      requestId,
      reason: "AUTH_REQUIRED",
      endpoint: "/api/orders/[id]",
      elapsedMs: Date.now() - startedAt,
    }, "warn");
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      logSafeOrderEvent("admin.order.status_change.failed", {
        requestId,
        orderId: id,
        reason: "INVALID_STATUS",
        endpoint: "/api/orders/[id]",
        requestedStatus: typeof status === "string" ? status : null,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "올바르지 않은 주문 상태입니다." }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      logSafeOrderEvent("admin.order.status_change.failed", {
        requestId,
        orderId: id,
        reason: "ORDER_NOT_FOUND",
        endpoint: "/api/orders/[id]",
        requestedStatus: status,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!canTransition(existing.status as OrderStatus, status)) {
      logSafeOrderEvent("admin.order.status_change.failed", {
        requestId,
        orderId: id,
        reason: "INVALID_STATUS_TRANSITION",
        endpoint: "/api/orders/[id]",
        previousStatus: existing.status,
        requestedStatus: status,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
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
      include: { items: { include: { product: true } } },
    });

    logSafeOrderEvent("admin.order.status_change.succeeded", {
      requestId,
      orderId: id,
      endpoint: "/api/orders/[id]",
      previousStatus: existing.status,
      nextStatus: order.status,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(order);
  } catch (error) {
    logSafeOrderError("admin.order.status_change.failed", {
      requestId,
      reason: "SERVER_ERROR",
      endpoint: "/api/orders/[id]",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ error: "주문 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
