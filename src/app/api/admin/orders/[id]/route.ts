import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "APPROVED", "DELIVERED", "CANCELLED"];
const DELETABLE_STATUSES: OrderStatus[] = ["PENDING", "CANCELLED"];

function isValidOrderId(id: string) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(id);
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidOrderId(id)) {
    return NextResponse.json({ error: "잘못된 주문 ID입니다." }, { status: 400 });
  }

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
    logSafeOrderEvent(
      "admin.order.status_change.failed",
      {
        requestId,
        reason: "AUTH_REQUIRED",
        elapsedMs: Date.now() - startedAt,
      },
      "warn",
    );
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!isValidOrderId(id)) {
      logSafeOrderEvent(
        "admin.order.status_change.failed",
        {
          requestId,
          reason: "INVALID_ORDER_ID",
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json({ error: "잘못된 주문 ID입니다." }, { status: 400 });
    }

    const { status } = await req.json();

    if (!status || !VALID_STATUSES.includes(status)) {
      logSafeOrderEvent(
        "admin.order.status_change.failed",
        {
          requestId,
          orderId: id,
          reason: "INVALID_STATUS",
          requestedStatus: typeof status === "string" ? status : null,
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json({ error: "올바르지 않은 주문 상태입니다." }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      logSafeOrderEvent(
        "admin.order.status_change.failed",
        {
          requestId,
          orderId: id,
          reason: "ORDER_NOT_FOUND",
          requestedStatus: status,
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!canTransition(existing.status as OrderStatus, status)) {
      logSafeOrderEvent(
        "admin.order.status_change.failed",
        {
          requestId,
          orderId: id,
          reason: "INVALID_STATUS_TRANSITION",
          previousStatus: existing.status,
          requestedStatus: status,
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
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

    logSafeOrderEvent("admin.order.status_change.succeeded", {
      requestId,
      orderId: id,
      previousStatus: existing.status,
      nextStatus: order.status,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(order);
  } catch (error) {
    logSafeOrderError(
      "admin.order.status_change.failed",
      {
        requestId,
        reason: "SERVER_ERROR",
        elapsedMs: Date.now() - startedAt,
      },
      error,
    );
    return NextResponse.json({ error: "주문 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    logSafeOrderEvent(
      "admin.order.delete.failed",
      {
        requestId,
        reason: "AUTH_REQUIRED",
        elapsedMs: Date.now() - startedAt,
      },
      "warn",
    );
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!isValidOrderId(id)) {
      logSafeOrderEvent(
        "admin.order.delete.failed",
        {
          requestId,
          reason: "INVALID_ORDER_ID",
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json({ error: "잘못된 주문 ID입니다." }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      logSafeOrderEvent(
        "admin.order.delete.failed",
        {
          requestId,
          orderId: id,
          reason: "ORDER_NOT_FOUND",
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!DELETABLE_STATUSES.includes(existing.status as OrderStatus)) {
      logSafeOrderEvent(
        "admin.order.delete.failed",
        {
          requestId,
          orderId: id,
          reason: "ORDER_STATUS_NOT_DELETABLE",
          currentStatus: existing.status,
          elapsedMs: Date.now() - startedAt,
        },
        "warn",
      );
      return NextResponse.json(
        { error: "주문삭제는 주문접수 또는 주문취소 상태에서만 가능합니다." },
        { status: 409 },
      );
    }

    await prisma.order.delete({
      where: { id },
    });

    logSafeOrderEvent("admin.order.delete.succeeded", {
      requestId,
      orderId: id,
      previousStatus: existing.status,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logSafeOrderError(
      "admin.order.delete.failed",
      {
        requestId,
        reason: "SERVER_ERROR",
        elapsedMs: Date.now() - startedAt,
      },
      error,
    );
    return NextResponse.json({ error: "주문 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
