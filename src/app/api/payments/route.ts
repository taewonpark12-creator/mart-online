import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSecurityHeaders } from "@/lib/security";
import { canTransition, getTransitionError } from "@/lib/order-status";
import { createRequestId, logOrderFailure, logOrderEvent, orderErrorBody } from "@/lib/order-observability";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";

type PaymentResult = "SUCCESS" | "FAILED";

class PaymentApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function jsonWithSecurity(body: unknown, init?: ResponseInit, requestId?: string) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => response.headers.set(key, value));
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}

function toPaymentStatus(result: PaymentResult): OrderStatus {
  return result === "SUCCESS" ? "PAID" : "FAILED";
}

function parsePaymentResult(value: unknown): PaymentResult | null {
  return value === "SUCCESS" || value === "FAILED" ? value : null;
}

function classifyPaymentError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return { code: "ORDER_NOT_FOUND", status: 404, message: "주문을 찾을 수 없습니다." };
    if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.code)) {
      return { code: "PRISMA_CONNECTION_ERROR", status: 503, message: "데이터베이스 연결 상태가 불안정합니다." };
    }
    return { code: "DB_UNKNOWN_ERROR", status: 500, message: "결제 상태 저장 중 데이터베이스 오류가 발생했습니다." };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { code: "PRISMA_VALIDATION_ERROR", status: 400, message: "결제 요청 형식이 올바르지 않습니다." };
  }

  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError) {
    return { code: "PRISMA_CONNECTION_ERROR", status: 503, message: "데이터베이스 연결 상태가 불안정합니다." };
  }

  return { code: "UNKNOWN_RUNTIME_ERROR", status: 500, message: "결제 상태 저장 중 오류가 발생했습니다." };
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let stage = "request_parse";
  let orderNumber: string | null = null;

  const elapsedMs = () => Date.now() - startedAt;
  const logStage = (nextStage: string, extra?: unknown) => {
    stage = nextStage;
    logOrderEvent({
      requestId,
      endpoint: "/api/payments",
      stage,
      elapsedMs: elapsedMs(),
      orderNumber,
      extra,
    });
  };

  try {
    logStage("request_parse");
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return jsonWithSecurity(
        orderErrorBody({ requestId, code: "INVALID_ORDER", error: "결제 요청 형식이 올바르지 않습니다.", stage }),
        { status: 400 },
        requestId,
      );
    }

    const payload = body as Record<string, unknown>;
    orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.trim() : null;
    const paymentResult = parsePaymentResult(payload.paymentResult);

    logStage("validation", { hasOrderNumber: Boolean(orderNumber), paymentResult });
    if (!orderNumber) {
      return jsonWithSecurity(
        orderErrorBody({ requestId, code: "INVALID_ORDER", error: "주문 식별자가 필요합니다.", stage }),
        { status: 400 },
        requestId,
      );
    }
    if (!paymentResult) {
      return jsonWithSecurity(
        orderErrorBody({ requestId, code: "INVALID_ORDER", error: "결제 결과가 올바르지 않습니다.", stage }),
        { status: 400 },
        requestId,
      );
    }

    const targetOrderNumber = orderNumber;
    const nextStatus = toPaymentStatus(paymentResult);
    logStage("payment_status_update", { nextStatus });
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { orderNumber: targetOrderNumber },
        select: { id: true, orderNumber: true, status: true },
      });

      if (!existing) {
        return null;
      }

      orderNumber = existing.orderNumber;

      if (!canTransition(existing.status as OrderStatus, nextStatus)) {
        throw new PaymentApiError(
          "INVALID_STATUS_TRANSITION",
          getTransitionError(existing.status as OrderStatus, nextStatus),
          409,
        );
      }

      return tx.order.update({
        where: { id: existing.id },
        data: { status: nextStatus },
        select: { orderNumber: true, status: true },
      });
    });

    if (!order) {
      return jsonWithSecurity(
        orderErrorBody({ requestId, code: "ORDER_NOT_FOUND", error: "주문을 찾을 수 없습니다.", stage }),
        { status: 404 },
        requestId,
      );
    }

    logStage("response_send", { status: 200, orderStatus: order.status });
    return jsonWithSecurity({ requestId, success: true, order }, { status: 200 }, requestId);
  } catch (error) {
    const details = error instanceof PaymentApiError
      ? { code: error.code, status: error.status, message: error.message }
      : classifyPaymentError(error);

    logOrderFailure({
      requestId,
      endpoint: "/api/payments",
      stage,
      elapsedMs: elapsedMs(),
      errorCode: details.code,
      message: details.message,
      orderNumber,
      error,
    });

    return jsonWithSecurity(
      orderErrorBody({ requestId, code: details.code, error: details.message, stage }),
      { status: details.status },
      requestId,
    );
  }
}
