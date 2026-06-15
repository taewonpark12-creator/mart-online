import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store";
import {
  PICKUP_TIME_SLOTS,
  generateOrderNumber,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";
import { createAuditLog } from "@/lib/audit";
import {
  validatePhoneNumber,
  validateName,
  validateAddress,
  sanitizeInput,
  getClientIp,
  getUserAgent,
  getSecurityHeaders,
} from "@/lib/security";
import { PriceSourceUnavailableError } from "@/lib/order-pricing";
import {
  OrderValidationError,
  validateSubmittedCart,
} from "@/lib/order-cart-validation";
import {
  createRequestId,
  logOrderEvent,
  logOrderFailure,
  orderErrorBody,
} from "@/lib/order-observability";

export const runtime = "nodejs";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];
const PICKUP_TIME_VALUES = new Set(PICKUP_TIME_SLOTS.map((s) => s.value));
const ORDER_NUMBER_RETRY_LIMIT = 5;

function jsonWithSecurity(body: unknown, init?: ResponseInit, requestId?: string) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
}

function fail(details: {
  requestId: string;
  code: string;
  error: string;
  status: number;
  stage?: string;
  elapsedMs?: number;
  clientOrderId?: string | null;
  orderNumber?: string | null;
  payloadSummary?: unknown;
  rawError?: unknown;
  priceSourceVersion?: string | null;
  productId?: string | null;
  endpoint?: string;
  updatedCart?: unknown;
}) {
  logOrderFailure({
    requestId: details.requestId,
    errorCode: details.code,
    stage: details.stage,
    elapsedMs: details.elapsedMs,
    priceSourceVersion: details.priceSourceVersion,
    productId: details.productId,
    endpoint: details.endpoint ?? "/api/orders",
    message: details.error,
    clientOrderId: details.clientOrderId,
    orderNumber: details.orderNumber,
    payloadSummary: details.payloadSummary,
    error: details.rawError,
  });

  return jsonWithSecurity(
    orderErrorBody({
      requestId: details.requestId,
      code: details.code,
      error: details.error,
      stage: details.stage,
      priceSourceVersion: details.priceSourceVersion,
      productId: details.productId,
      updatedCart: details.updatedCart,
    }),
    { status: details.status },
    details.requestId,
  );
}

function parseClientOrderId(value: unknown) {
  const clientOrderId = typeof value === "string" ? value.trim() : "";
  if (!clientOrderId || clientOrderId.length > 100) {
    throw new OrderValidationError("INVALID_ORDER", "clientOrderId媛 ?꾩슂?⑸땲??");
  }
  return clientOrderId;
}

function isPrismaUniqueError(error: unknown, field?: string) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  if (!field) return true;

  const target = "meta" in error ? (error as { meta?: { target?: unknown } }).meta?.target : undefined;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

function getElapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function getPrismaTarget(error: unknown) {
  if (typeof error !== "object" || error === null || !("meta" in error)) return undefined;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return undefined;
}

function summarizePayload(body: Record<string, unknown> | null | undefined) {
  if (!body) return null;
  const items = Array.isArray(body.items) ? body.items : [];
  return {
    hasClientOrderId: typeof body.clientOrderId === "string" && body.clientOrderId.trim().length > 0,
    fulfillmentType: body.fulfillmentType,
    paymentMethod: body.paymentMethod,
    itemCount: items.length,
    submittedTotalAmount: body.totalAmount,
    productIds: items
      .map((item) => (item && typeof item === "object" ? (item as { productId?: unknown }).productId : undefined))
      .filter(Boolean)
      .slice(0, 20),
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...("code" in error ? { code: error.code } : {}),
      ...("meta" in error ? { meta: error.meta } : {}),
    };
  }
  return error;
}

function classifyPrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = getPrismaTarget(error);
      if (target?.some((field) => field.includes("clientOrderId"))) {
        return { errorCode: "DUPLICATE_CLIENT_ORDER_ID", status: 409, message: "?대? 泥섎━??二쇰Ц ?붿껌?낅땲??", target };
      }
      if (target?.some((field) => field.includes("orderNumber"))) {
        return { errorCode: "DUPLICATE_ORDER_NUMBER", status: 409, message: "二쇰Ц踰덊샇 ?앹꽦 以?異⑸룎??諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.", target };
      }
      return { errorCode: "UNIQUE_CONSTRAINT_VIOLATION", status: 409, message: "以묐났???곗씠?곌? ?덉뼱 泥섎━?섏? 紐삵뻽?듬땲??", target };
    }
    if (error.code === "P2025") {
      return { errorCode: "NOT_FOUND", status: 404, message: "?붿껌???곗씠?곕? 李얠쓣 ???놁뒿?덈떎." };
    }
    if (error.code === "P2003") {
      return { errorCode: "FOREIGN_KEY_ERROR", status: 409, message: "?곌껐???곗씠?곌? ?щ컮瑜댁? ?딆븘 二쇰Ц??泥섎━?섏? 紐삵뻽?듬땲??" };
    }
    if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.code)) {
      return { errorCode: "PRISMA_CONNECTION_ERROR", status: 503, message: "?곗씠?곕쿋?댁뒪 ?곌껐 ?곹깭媛 遺덉븞?뺥빀?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂." };
    }
    return { errorCode: "DB_UNKNOWN_ERROR", status: 500, message: "데이터베이스 처리 중 알 수 없는 오류가 발생했습니다." };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { errorCode: "PRISMA_VALIDATION_ERROR", status: 400, message: "二쇰Ц ?곗씠???뺤떇???щ컮瑜댁? ?딆뒿?덈떎." };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { errorCode: "PRISMA_INITIALIZATION_ERROR", status: 503, message: "?곗씠?곕쿋?댁뒪 ?곌껐??珥덇린?뷀븯吏 紐삵뻽?듬땲??" };
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return { errorCode: "PRISMA_CONNECTION_ERROR", status: 503, message: "?곗씠?곕쿋?댁뒪 泥섎━ ?붿쭊 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂." };
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return { errorCode: "DB_UNKNOWN_ERROR", status: 500, message: "데이터베이스 요청 처리 중 알 수 없는 오류가 발생했습니다." };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let stage = "start";
  let priceSourceVersion: string | undefined;
  let clientOrderIdForRecovery: string | undefined;
  let orderNumberForLog: string | undefined;
  let payloadSummary: unknown = null;
  const userAgent = getUserAgent(req);

  const logStage = (nextStage: string, extra?: unknown) => {
    stage = nextStage;
    logOrderEvent({
      requestId,
      stage,
      elapsedMs: getElapsedMs(startedAt),
      clientOrderId: clientOrderIdForRecovery,
      orderNumber: orderNumberForLog,
      priceSourceVersion,
      userAgent,
      extra,
    });
  };

  const failAtCurrentStage = (details: Omit<Parameters<typeof fail>[0], "requestId" | "stage" | "elapsedMs" | "clientOrderId" | "orderNumber" | "payloadSummary">) =>
    fail({
      ...details,
      requestId,
      stage,
      elapsedMs: getElapsedMs(startedAt),
      clientOrderId: clientOrderIdForRecovery,
      orderNumber: orderNumberForLog,
      payloadSummary,
    });

  try {
    logStage("start", {
      clientOrderId: req.headers.get("x-client-order-id"),
      userAgent,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
      vercel: Boolean(process.env.VERCEL),
    });
    logStage("request_parse");
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      throw new OrderValidationError("INVALID_ORDER", "二쇰Ц ?붿껌 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.");
    }
    payloadSummary = summarizePayload(body as Record<string, unknown>);
    logStage("request_parse_complete", payloadSummary);
    const {
      clientOrderId: rawClientOrderId,
      customerName,
      customerPhone,
      fulfillmentType: rawFulfillment,
      deliveryAddress,
      deliveryEntrance,
      pickupTime,
      memo,
      paymentMethod,
      items,
      totalAmount: submittedTotalAmount,
    } = body;

    const clientOrderId = parseClientOrderId(rawClientOrderId);
    clientOrderIdForRecovery = clientOrderId;
    logStage("idempotency_check", { clientOrderId });

    const existingOrder = await prisma.order.findUnique({
      where: { clientOrderId },
      select: { orderNumber: true, priceSourceVersion: true },
    });
    if (existingOrder) {
      orderNumberForLog = existingOrder.orderNumber;
      priceSourceVersion = existingOrder.priceSourceVersion ?? undefined;
      logStage("response_send", { duplicate: true, status: 200 });
      return jsonWithSecurity(
        {
          requestId,
          orderNumber: existingOrder.orderNumber,
          clientOrderId,
          duplicate: true,
          priceSourceVersion: existingOrder.priceSourceVersion,
        },
        { status: 200 },
        requestId,
      );
    }

    logStage("validation");
    if (!VALID_FULFILLMENT.includes(rawFulfillment)) {
      return failAtCurrentStage({
        code: "INVALID_ORDER",
        error: "?섎졊 諛⑹떇???щ컮瑜닿쾶 ?좏깮?댁＜?몄슂.",
        status: 400,
      });
    }

    const fulfillmentType: FulfillmentType = rawFulfillment;
    const safeCustomerName = sanitizeInput(String(customerName ?? ""));
    const safeCustomerPhone = sanitizeInput(String(customerPhone ?? ""));
    const safeDeliveryAddress = sanitizeInput(String(deliveryAddress ?? ""));
    const safeDeliveryEntrance = sanitizeInput(String(deliveryEntrance ?? ""));
    const safePickupTime = sanitizeInput(String(pickupTime ?? ""));
    const safeMemo = sanitizeInput(String(memo ?? ""));

    if (!safeCustomerName || !validateName(safeCustomerName)) {
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "?좏슚?섏? ?딆? ?대쫫?낅땲??", status: 400 });
    }

    if (!safeCustomerPhone || !validatePhoneNumber(safeCustomerPhone)) {
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "?좏슚?섏? ?딆? ?곕씫泥섏엯?덈떎.", status: 400 });
    }

    if (fulfillmentType === "DELIVERY") {
      if (!safeDeliveryAddress || !validateAddress(safeDeliveryAddress)) {
        return failAtCurrentStage({ code: "INVALID_ORDER", error: "?좏슚?섏? ?딆? 諛곕떖 二쇱냼?낅땲??", status: 400 });
      }
      if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
        return failAtCurrentStage({ code: "INVALID_ORDER", error: "寃곗젣 諛⑸쾿???좏깮?댁＜?몄슂.", status: 400 });
      }
    } else if (!safePickupTime || !PICKUP_TIME_VALUES.has(safePickupTime)) {
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "?쎌뾽 ?덉젙 ?쒓컙???좏깮?댁＜?몄슂.", status: 400 });
    }

    logStage("price_validation");
    const validated = await validateSubmittedCart(items, submittedTotalAmount);
    priceSourceVersion = validated.priceSourceVersion;
    const isPickup = fulfillmentType === "PICKUP";
    logStage("price_validation_complete", {
      itemCount: validated.orderItems.length,
      totalAmount: validated.totalAmount,
      priceSourceVersion,
    });

    logStage("transaction_start");
    const order = await prisma.$transaction(async (tx) => {
      const runTransactionStage = async <T,>(
        nextStage: string,
        action: () => Promise<T>,
        extra?: unknown,
      ) => {
        logStage(nextStage, extra);
        try {
          return await action();
        } catch (transactionStageError) {
          logOrderFailure({
            requestId,
            errorCode: "TRANSACTION_STAGE_ERROR",
            stage: nextStage,
            elapsedMs: getElapsedMs(startedAt),
            priceSourceVersion,
            endpoint: "/api/orders",
            clientOrderId: clientOrderIdForRecovery,
            orderNumber: orderNumberForLog,
            payloadSummary,
            error: serializeError(transactionStageError),
          });
          throw transactionStageError;
        }
      };

      try {
      const duplicate = await runTransactionStage("transaction_idempotency_check", () =>
        tx.order.findUnique({
          where: { clientOrderId },
          select: { id: true, orderNumber: true, priceSourceVersion: true },
        }),
      );
      if (duplicate) {
        orderNumberForLog = duplicate.orderNumber;
        logStage("response_send", { duplicate: true, status: 200 });
        return duplicate;
      }

      logStage("order_number_generate");
      let nextOrderNumber = generateOrderNumber();
      let hasAvailableOrderNumber = false;
      for (let attempt = 0; attempt < ORDER_NUMBER_RETRY_LIMIT; attempt++) {
        const existingOrderNumber = await runTransactionStage(
          "order_number_check",
          () =>
            tx.order.findUnique({
              where: { orderNumber: nextOrderNumber },
              select: { id: true },
            }),
          { attempt, orderNumber: nextOrderNumber },
        );
        if (!existingOrderNumber) {
          hasAvailableOrderNumber = true;
          break;
        }
        nextOrderNumber = generateOrderNumber();
      }
      if (!hasAvailableOrderNumber) {
        throw new OrderValidationError(
          "DUPLICATE_ORDER_NUMBER",
          "二쇰Ц踰덊샇 ?앹꽦 以?異⑸룎??諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.",
          409,
          undefined,
          undefined,
          validated.priceSourceVersion,
        );
      }

      orderNumberForLog = nextOrderNumber;
      return runTransactionStage(
        "order_create",
        () =>
          tx.order.create({
            data: {
              clientOrderId,
              priceSourceVersion: validated.priceSourceVersion,
              orderNumber: nextOrderNumber,
              status: "PENDING",
              customerName: safeCustomerName,
              customerPhone: safeCustomerPhone,
              fulfillmentType,
              deliveryAddress: isPickup ? `留ㅼ옣 ?쎌뾽 쨌 ${STORE.name}` : safeDeliveryAddress,
              deliveryEntrance: isPickup ? null : safeDeliveryEntrance || null,
              pickupTime: isPickup ? safePickupTime : null,
              memo: safeMemo || null,
              paymentMethod: isPickup ? null : paymentMethod,
              totalAmount: validated.totalAmount,
              items: { create: validated.orderItems },
            },
            select: { id: true, orderNumber: true, priceSourceVersion: true },
          }),
        { orderNumber: nextOrderNumber },
      );
      } catch (transactionError) {
        logOrderFailure({
          requestId,
          errorCode: "TRANSACTION_ERROR",
          stage,
          elapsedMs: getElapsedMs(startedAt),
          priceSourceVersion,
          endpoint: "/api/orders",
          clientOrderId: clientOrderIdForRecovery,
          orderNumber: orderNumberForLog,
          payloadSummary,
          error: serializeError(transactionError),
        });
        throw transactionError;
      }
    });
    orderNumberForLog = order.orderNumber;
    logStage("transaction_commit", { orderNumber: order.orderNumber });

    await createAuditLog({
      action: "CREATE",
      entity: "Order",
      entityId: order.id,
      changes: {
        requestId,
        orderNumber: order.orderNumber,
        customerName: safeCustomerName,
        totalAmount: validated.totalAmount,
        itemCount: validated.orderItems.length,
        priceSourceVersion: validated.priceSourceVersion,
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    logStage("audit_log", { orderNumber: order.orderNumber });

    logStage("response_send", { status: 201, orderNumber: order.orderNumber });
    return jsonWithSecurity(
      {
        requestId,
        orderNumber: order.orderNumber,
        clientOrderId,
        priceSourceVersion: order.priceSourceVersion,
      },
      { status: 201 },
      requestId,
    );
  } catch (error) {
    const serializedError = serializeError(error);
    const baseFailure = {
      stage,
      elapsedMs: getElapsedMs(startedAt),
      clientOrderId: clientOrderIdForRecovery,
      orderNumber: orderNumberForLog,
      payloadSummary,
      rawError: serializedError,
      priceSourceVersion,
    };

    if (clientOrderIdForRecovery && isPrismaUniqueError(error, "clientOrderId")) {
      try {
        logStage("idempotency_recovery");
        const existing = await prisma.order.findUnique({
          where: { clientOrderId: clientOrderIdForRecovery },
          select: { orderNumber: true, priceSourceVersion: true },
        });
        if (existing) {
          orderNumberForLog = existing.orderNumber;
          priceSourceVersion = existing.priceSourceVersion ?? priceSourceVersion;
          logStage("response_send", { duplicate: true, status: 200 });
          return jsonWithSecurity(
            {
              requestId,
              orderNumber: existing.orderNumber,
              clientOrderId: clientOrderIdForRecovery,
              duplicate: true,
              priceSourceVersion: existing.priceSourceVersion,
            },
            { status: 200 },
            requestId,
          );
        }
      } catch (recoveryError) {
        logOrderFailure({
          requestId,
          errorCode: "DUPLICATE_CLIENT_ORDER_ID_RECOVERY_FAILED",
          stage: "idempotency_recovery",
          elapsedMs: getElapsedMs(startedAt),
          priceSourceVersion,
          endpoint: "/api/orders",
          clientOrderId: clientOrderIdForRecovery,
          orderNumber: orderNumberForLog,
          payloadSummary,
          error: serializeError(recoveryError),
        });
      }
    }

    if (error instanceof PriceSourceUnavailableError) {
      return fail({
        requestId,
        code: "PRICE_SOURCE_UNAVAILABLE",
        error: "PRICE_SOURCE_UNAVAILABLE",
        status: 503,
        ...baseFailure,
      });
    }

    if (error instanceof SyntaxError) {
      return fail({
        requestId,
        code: "INVALID_ORDER",
        error: "주문 요청 형식이 올바르지 않습니다.",
        status: 400,
        ...baseFailure,
        stage: "request_parse",
      });
    }

    if (error instanceof OrderValidationError) {
      return fail({
        requestId,
        code: error.code,
        error: error.message,
        status: error.status,
        ...baseFailure,
        priceSourceVersion: error.priceSourceVersion ?? priceSourceVersion,
        productId: error.productId,
        updatedCart: error.updatedCart,
      });
    }

    const prismaError = classifyPrismaError(error);
    if (prismaError) {
      return fail({
        requestId,
        code: prismaError.errorCode,
        error: prismaError.message,
        status: prismaError.status,
        ...baseFailure,
      });
    }

    return fail({
      requestId,
      code: error instanceof TypeError ? "NULL_POINTER" : "UNKNOWN_RUNTIME_ERROR",
      error: "주문 처리 중 오류가 발생했습니다.",
      status: 500,
      ...baseFailure,
    });
  }
}
