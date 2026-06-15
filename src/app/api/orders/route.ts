import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store";
import {
  MIN_ORDER_AMOUNT,
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
const ORDER_NUMBER_RETRY_LIMIT = 3;

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
    throw new OrderValidationError("INVALID_ORDER", "clientOrderId가 필요합니다.");
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

function isMissingOrderMetadataColumn(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
    return false;
  }

  const metaText = JSON.stringify(error.meta ?? {});
  return metaText.includes("clientOrderId") || metaText.includes("priceSourceVersion");
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

function assertNoUnsafePrismaValue(value: unknown, path = "data") {
  if (value === undefined) {
    throw new OrderValidationError("INVALID_ORDER", `${path} 값이 올바르지 않습니다.`);
  }
  if (typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))) {
    throw new OrderValidationError("INVALID_ORDER", `${path} 숫자 값이 올바르지 않습니다.`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafePrismaValue(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, childValue]) => {
      assertNoUnsafePrismaValue(childValue, `${path}.${key}`);
    });
  }
}

function buildOrderCreateData(details: {
  clientOrderId: string;
  priceSourceVersion: string;
  includeMetadata: boolean;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  deliveryEntrance: string;
  pickupTime: string;
  memo: string;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  orderItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}) {
  const isPickup = details.fulfillmentType === "PICKUP";
  const data = {
    ...(details.includeMetadata
      ? {
          clientOrderId: details.clientOrderId,
          priceSourceVersion: details.priceSourceVersion,
        }
      : {}),
    orderNumber: details.orderNumber,
    status: "PENDING" as const,
    customerName: details.customerName,
    customerPhone: details.customerPhone,
    fulfillmentType: details.fulfillmentType,
    deliveryAddress: isPickup ? `매장 픽업 · ${STORE.name}` : details.deliveryAddress,
    deliveryEntrance: isPickup ? null : details.deliveryEntrance || null,
    pickupTime: isPickup ? details.pickupTime : null,
    memo: details.memo || null,
    paymentMethod: isPickup ? null : details.paymentMethod,
    totalAmount: details.totalAmount,
    items: { create: details.orderItems },
  } satisfies Prisma.OrderCreateInput;

  assertNoUnsafePrismaValue(data);
  return data;
}

function classifyPrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = getPrismaTarget(error);
      if (target?.some((field) => field.includes("clientOrderId"))) {
        return { errorCode: "DUPLICATE_CLIENT_ORDER_ID", status: 409, message: "이미 처리된 주문 요청입니다.", target };
      }
      if (target?.some((field) => field.includes("orderNumber"))) {
        return { errorCode: "DUPLICATE_ORDER_NUMBER", status: 409, message: "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해주세요.", target };
      }
      return { errorCode: "UNIQUE_CONSTRAINT_VIOLATION", status: 409, message: "중복된 데이터가 있어 처리하지 못했습니다.", target };
    }
    if (error.code === "P2025") {
      return { errorCode: "NOT_FOUND", status: 404, message: "요청한 데이터를 찾을 수 없습니다." };
    }
    if (error.code === "P2003") {
      return { errorCode: "FOREIGN_KEY_ERROR", status: 409, message: "연결된 데이터가 올바르지 않아 주문을 처리하지 못했습니다." };
    }
    if (error.code === "P2022") {
      if (isMissingOrderMetadataColumn(error)) {
        return {
          errorCode: "ORDER_METADATA_COLUMNS_MISSING",
          status: 503,
          message: "주문 DB 스키마가 최신 상태가 아닙니다. clientOrderId/priceSourceVersion 컬럼을 확인해주세요.",
        };
      }
      return {
        errorCode: "DB_SCHEMA_MISMATCH",
        status: 503,
        message: "주문 DB 스키마가 애플리케이션과 일치하지 않습니다.",
      };
    }
    if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.code)) {
      return { errorCode: "PRISMA_CONNECTION_ERROR", status: 503, message: "데이터베이스 연결 상태가 불안정합니다. 잠시 후 다시 시도해주세요." };
    }
    return { errorCode: "DB_UNKNOWN_ERROR", status: 503, message: "데이터베이스 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { errorCode: "PRISMA_VALIDATION_ERROR", status: 400, message: "주문 데이터 형식이 올바르지 않습니다." };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { errorCode: "PRISMA_INITIALIZATION_ERROR", status: 503, message: "데이터베이스 연결을 초기화하지 못했습니다." };
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return { errorCode: "PRISMA_CONNECTION_ERROR", status: 503, message: "데이터베이스 처리 엔진 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return { errorCode: "DB_UNKNOWN_ERROR", status: 503, message: "데이터베이스 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
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
  let supportsOrderMetadata = true;
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
      throw new OrderValidationError("INVALID_ORDER", "주문 요청 형식이 올바르지 않습니다.");
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
    } = body;

    const clientOrderId = parseClientOrderId(rawClientOrderId);
    clientOrderIdForRecovery = clientOrderId;
    logStage("idempotency_check", { clientOrderId });

    let existingOrder: { orderNumber: string; priceSourceVersion?: string | null } | null = null;
    try {
      existingOrder = await prisma.order.findUnique({
        where: { clientOrderId },
        select: { orderNumber: true, priceSourceVersion: true },
      });
    } catch (metadataError) {
      if (!isMissingOrderMetadataColumn(metadataError)) {
        throw metadataError;
      }
      supportsOrderMetadata = false;
      logOrderFailure({
        requestId,
        errorCode: "ORDER_METADATA_COLUMNS_MISSING",
        stage: "idempotency_check",
        elapsedMs: getElapsedMs(startedAt),
        endpoint: "/api/orders",
        clientOrderId,
        payloadSummary,
        message: "clientOrderId/priceSourceVersion columns are missing; continuing without idempotency metadata.",
        error: serializeError(metadataError),
      });
    }
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
        error: "수령 방식을 올바르게 선택해주세요.",
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
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "유효하지 않은 이름입니다.", status: 400 });
    }

    if (!safeCustomerPhone || !validatePhoneNumber(safeCustomerPhone)) {
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "유효하지 않은 연락처입니다.", status: 400 });
    }

    if (fulfillmentType === "DELIVERY") {
      if (!safeDeliveryAddress || !validateAddress(safeDeliveryAddress)) {
        return failAtCurrentStage({ code: "INVALID_ORDER", error: "유효하지 않은 배달 주소입니다.", status: 400 });
      }
      if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
        return failAtCurrentStage({ code: "INVALID_ORDER", error: "결제 방법을 선택해주세요.", status: 400 });
      }
    } else if (!safePickupTime || !PICKUP_TIME_VALUES.has(safePickupTime)) {
      return failAtCurrentStage({ code: "INVALID_ORDER", error: "픽업 예정 시간을 선택해주세요.", status: 400 });
    }

    logStage("price_validation");
    logStage("items_raw_payload", { items });
    const validated = await validateSubmittedCart(items);
    priceSourceVersion = validated.priceSourceVersion;
    logStage("price_validation_complete", {
      itemCount: validated.orderItems.length,
      parsedItems: validated.submittedItems,
      orderItems: validated.orderItems,
      totalAmount: validated.totalAmount,
      minimumOrderWarning: validated.minimumOrderWarning,
      priceSourceVersion,
    });
    console.log({
      requestId,
      clientOrderId,
      itemsCount: validated.orderItems.length,
      rawItems: items,
      parsedItems: validated.submittedItems,
      serverCalculatedTotalAmount: validated.totalAmount,
      MIN_ORDER_AMOUNT,
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
      if (supportsOrderMetadata) {
        const duplicate = await runTransactionStage("transaction_idempotency_check", () =>
          tx.order.findUnique({
            where: { clientOrderId },
            select: { id: true, orderNumber: true, priceSourceVersion: true },
          }),
        );
        if (duplicate) {
          orderNumberForLog = duplicate.orderNumber;
          logStage("response_send", { duplicate: true, status: 200 });
          return { ...duplicate, duplicate: true };
        }
      } else {
        logStage("transaction_idempotency_skipped", { reason: "ORDER_METADATA_COLUMNS_MISSING" });
      }

      for (let attempt = 0; attempt < ORDER_NUMBER_RETRY_LIMIT; attempt++) {
        logStage("order_number_generate", { attempt });
        const nextOrderNumber = generateOrderNumber();
        orderNumberForLog = nextOrderNumber;
        const orderCreateData = buildOrderCreateData({
          clientOrderId,
          priceSourceVersion: validated.priceSourceVersion,
          includeMetadata: supportsOrderMetadata,
          orderNumber: nextOrderNumber,
          customerName: safeCustomerName,
          customerPhone: safeCustomerPhone,
          fulfillmentType,
          deliveryAddress: safeDeliveryAddress,
          deliveryEntrance: safeDeliveryEntrance,
          pickupTime: safePickupTime,
          memo: safeMemo,
          paymentMethod: paymentMethod as PaymentMethod | null,
          totalAmount: validated.totalAmount,
          orderItems: validated.orderItems,
        });

        logStage("prisma_input_payload", {
          attempt,
          data: orderCreateData,
        });

        try {
          const createdOrder = await runTransactionStage(
            "order_create",
            () =>
              tx.order.create({
                data: orderCreateData,
                select: supportsOrderMetadata
                  ? { id: true, orderNumber: true, priceSourceVersion: true }
                  : { id: true, orderNumber: true },
              }),
            { attempt, orderNumber: nextOrderNumber },
          );
          return {
            ...createdOrder,
            priceSourceVersion: "priceSourceVersion" in createdOrder ? createdOrder.priceSourceVersion : null,
            duplicate: false,
          };
        } catch (createError) {
          if (supportsOrderMetadata && isPrismaUniqueError(createError, "clientOrderId")) {
            const existing = await runTransactionStage(
              "order_create_duplicate_recovery",
              () =>
                tx.order.findUnique({
                  where: { clientOrderId },
                  select: { id: true, orderNumber: true, priceSourceVersion: true },
                }),
              { attempt, clientOrderId },
            );
            if (existing) {
              orderNumberForLog = existing.orderNumber;
              return { ...existing, duplicate: true };
            }
            if (attempt < ORDER_NUMBER_RETRY_LIMIT - 1) {
              logOrderFailure({
                requestId,
                errorCode: "DUPLICATE_CLIENT_ORDER_ID_RETRY",
                stage: "order_create",
                elapsedMs: getElapsedMs(startedAt),
                priceSourceVersion,
                endpoint: "/api/orders",
                clientOrderId: clientOrderIdForRecovery,
                orderNumber: nextOrderNumber,
                payloadSummary,
                error: serializeError(createError),
              });
              continue;
            }
          }

          if (isMissingOrderMetadataColumn(createError) && supportsOrderMetadata) {
            supportsOrderMetadata = false;
            logOrderFailure({
              requestId,
              errorCode: "ORDER_METADATA_COLUMNS_MISSING",
              stage: "order_create",
              elapsedMs: getElapsedMs(startedAt),
              priceSourceVersion,
              endpoint: "/api/orders",
              clientOrderId: clientOrderIdForRecovery,
              orderNumber: nextOrderNumber,
              payloadSummary,
              message: "Order metadata columns are missing during create; aborting this transaction.",
              error: serializeError(createError),
            });
            throw createError;
          }

          if (isPrismaUniqueError(createError, "orderNumber") && attempt < ORDER_NUMBER_RETRY_LIMIT - 1) {
            logOrderFailure({
              requestId,
              errorCode: "DUPLICATE_ORDER_NUMBER_RETRY",
              stage: "order_create",
              elapsedMs: getElapsedMs(startedAt),
              priceSourceVersion,
              endpoint: "/api/orders",
              clientOrderId: clientOrderIdForRecovery,
              orderNumber: nextOrderNumber,
              payloadSummary,
              error: serializeError(createError),
            });
            continue;
          }

          throw createError;
        }
      }

      throw new OrderValidationError(
        "DUPLICATE_ORDER_NUMBER",
        "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해주세요.",
        409,
        undefined,
        undefined,
        validated.priceSourceVersion,
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

    try {
      if (order.duplicate) {
        logStage("audit_log_skipped", { duplicate: true, orderNumber: order.orderNumber });
      } else {
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
      }
    } catch (auditError) {
      logOrderFailure({
        requestId,
        errorCode: "AUDIT_LOG_FAILED",
        stage: "audit_log",
        elapsedMs: getElapsedMs(startedAt),
        priceSourceVersion,
        endpoint: "/api/orders",
        clientOrderId: clientOrderIdForRecovery,
        orderNumber: order.orderNumber,
        payloadSummary,
        error: serializeError(auditError),
      });
    }

    logStage("response_send", { status: order.duplicate ? 200 : 201, orderNumber: order.orderNumber });
    return jsonWithSecurity(
      {
        requestId,
        orderNumber: order.orderNumber,
        clientOrderId,
        duplicate: order.duplicate,
        priceSourceVersion: order.priceSourceVersion,
        totalAmount: validated.totalAmount,
        warning: validated.minimumOrderWarning,
      },
      { status: order.duplicate ? 200 : 201 },
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
      status: 503,
      ...baseFailure,
    });
  }
}
