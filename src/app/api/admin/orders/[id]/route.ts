import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "APPROVED", "DELIVERED", "CANCELLED"];
const DELETABLE_STATUSES: OrderStatus[] = ["PENDING", "CANCELLED"];

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
  const requestId = createRequestId();
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    logSafeOrderEvent("admin.order.status_change.failed", {
      requestId,
      reason: "AUTH_REQUIRED",
      elapsedMs: Date.now() - startedAt,
    }, "warn");
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!status || !VALID_STATUSES.includes(status)) {
      logSafeOrderEvent("admin.order.status_change.failed", {
        requestId,
        orderId: id,
        reason: "INVALID_STATUS",
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
        requestedStatus: status,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    logSafeOrderEvent("admin.order.status_change.succeeded", {
      requestId,
      orderId: id,
      previousStatus: existing.status,
      nextStatus: order.status,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(order);
  } catch (error) {
    logSafeOrderError("admin.order.status_change.failed", {
      requestId,
      reason: "SERVER_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ error: "주문 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    logSafeOrderEvent("admin.order.delete.failed", {
      requestId,
      reason: "AUTH_REQUIRED",
      elapsedMs: Date.now() - startedAt,
    }, "warn");
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      logSafeOrderEvent("admin.order.delete.failed", {
        requestId,
        orderId: id,
        reason: "ORDER_NOT_FOUND",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!DELETABLE_STATUSES.includes(existing.status as OrderStatus)) {
      logSafeOrderEvent("admin.order.delete.failed", {
        requestId,
        orderId: id,
        reason: "ORDER_STATUS_NOT_DELETABLE",
        currentStatus: existing.status,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json(
        { error: "주문삭제는 신규주문 또는 취소된 주문만 가능합니다." },
        { status: 409 },
      );
    }

    // Delete the order - OrderItems will be cascade deleted automatically due to the schema
    await prisma.order.delete({
      where: { id },
    });

    logSafeOrderEvent("admin.order.delete.succeeded", {
      requestId,
      orderId: id,
      previousStatus: existing.status,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({ message: "주문이 삭제되었습니다." });
  } catch (error) {
    logSafeOrderError("admin.order.delete.failed", {
      requestId,
      reason: "SERVER_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ error: "주문 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
