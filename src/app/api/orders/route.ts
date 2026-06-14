import { NextRequest, NextResponse } from "next/server";
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
  logOrderFailure,
  orderErrorBody,
} from "@/lib/order-observability";

export const runtime = "nodejs";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];
const PICKUP_TIME_VALUES = new Set(PICKUP_TIME_SLOTS.map((s) => s.value));
const ORDER_NUMBER_RETRY_LIMIT = 5;

function jsonWithSecurity(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function fail(details: {
  requestId: string;
  code: string;
  error: string;
  status: number;
  priceSourceVersion?: string | null;
  productId?: string | null;
  endpoint?: string;
  updatedCart?: unknown;
}) {
  logOrderFailure({
    requestId: details.requestId,
    errorCode: details.code,
    priceSourceVersion: details.priceSourceVersion,
    productId: details.productId,
    endpoint: details.endpoint ?? "/api/orders",
    message: details.error,
  });

  return jsonWithSecurity(
    orderErrorBody({
      requestId: details.requestId,
      code: details.code,
      error: details.error,
      priceSourceVersion: details.priceSourceVersion,
      productId: details.productId,
      updatedCart: details.updatedCart,
    }),
    { status: details.status },
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

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  let priceSourceVersion: string | undefined;
  let clientOrderIdForRecovery: string | undefined;

  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      throw new OrderValidationError("INVALID_ORDER", "주문 요청 형식이 올바르지 않습니다.");
    }
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
      outOfStockPolicy,
      items,
      totalAmount: submittedTotalAmount,
    } = body;

    const clientOrderId = parseClientOrderId(rawClientOrderId);
    clientOrderIdForRecovery = clientOrderId;

    const existingOrder = await prisma.order.findUnique({
      where: { clientOrderId },
      select: { orderNumber: true, priceSourceVersion: true },
    });
    if (existingOrder) {
      return jsonWithSecurity(
        {
          requestId,
          orderNumber: existingOrder.orderNumber,
          clientOrderId,
          duplicate: true,
          priceSourceVersion: existingOrder.priceSourceVersion,
        },
        { status: 200 },
      );
    }

    if (!VALID_FULFILLMENT.includes(rawFulfillment)) {
      return fail({
        requestId,
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
      return fail({ requestId, code: "INVALID_ORDER", error: "유효하지 않은 이름입니다.", status: 400 });
    }

    if (!safeCustomerPhone || !validatePhoneNumber(safeCustomerPhone)) {
      return fail({ requestId, code: "INVALID_ORDER", error: "유효하지 않은 연락처입니다.", status: 400 });
    }

    if (fulfillmentType === "DELIVERY") {
      if (!safeDeliveryAddress || !validateAddress(safeDeliveryAddress)) {
        return fail({ requestId, code: "INVALID_ORDER", error: "유효하지 않은 배달 주소입니다.", status: 400 });
      }
      if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
        return fail({ requestId, code: "INVALID_ORDER", error: "결제 방법을 선택해주세요.", status: 400 });
      }
    } else if (!safePickupTime || !PICKUP_TIME_VALUES.has(safePickupTime)) {
      return fail({ requestId, code: "INVALID_ORDER", error: "픽업 예정 시간을 선택해주세요.", status: 400 });
    }

    const validated = await validateSubmittedCart(items, submittedTotalAmount);
    priceSourceVersion = validated.priceSourceVersion;
    const isPickup = fulfillmentType === "PICKUP";

    const order = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.order.findUnique({
        where: { clientOrderId },
        select: { id: true, orderNumber: true, priceSourceVersion: true },
      });
      if (duplicate) return duplicate;

      for (const item of validated.orderItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            isOutOfStock: false,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new OrderValidationError(
            "OUT_OF_STOCK",
            "재고가 부족한 상품이 포함되어 있습니다. 장바구니를 다시 확인해주세요.",
            409,
            item.productId,
            validated.updatedCart,
            validated.priceSourceVersion,
          );
        }
      }

      let nextOrderNumber = generateOrderNumber();
      let hasAvailableOrderNumber = false;
      for (let attempt = 0; attempt < ORDER_NUMBER_RETRY_LIMIT; attempt++) {
        const existingOrderNumber = await tx.order.findUnique({
          where: { orderNumber: nextOrderNumber },
          select: { id: true },
        });
        if (!existingOrderNumber) {
          hasAvailableOrderNumber = true;
          break;
        }
        nextOrderNumber = generateOrderNumber();
      }
      if (!hasAvailableOrderNumber) {
        throw new OrderValidationError(
          "DUPLICATE_ORDER_NUMBER",
          "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해주세요.",
          409,
          undefined,
          undefined,
          validated.priceSourceVersion,
        );
      }

      return tx.order.create({
        data: {
          clientOrderId,
          priceSourceVersion: validated.priceSourceVersion,
          orderNumber: nextOrderNumber,
          customerName: safeCustomerName,
          customerPhone: safeCustomerPhone,
          fulfillmentType,
          deliveryAddress: isPickup ? `매장 픽업 · ${STORE.name}` : safeDeliveryAddress,
          deliveryEntrance: isPickup ? null : safeDeliveryEntrance || null,
          pickupTime: isPickup ? safePickupTime : null,
          memo: safeMemo || null,
          paymentMethod: isPickup ? null : paymentMethod,
          outOfStockPolicy: outOfStockPolicy ?? "CONTACT",
          totalAmount: validated.totalAmount,
          items: { create: validated.orderItems },
        },
        select: { id: true, orderNumber: true, priceSourceVersion: true },
      });
    });

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

    return jsonWithSecurity(
      {
        requestId,
        orderNumber: order.orderNumber,
        clientOrderId,
        priceSourceVersion: order.priceSourceVersion,
      },
      { status: 201 },
    );
  } catch (error) {
    if (clientOrderIdForRecovery && isPrismaUniqueError(error, "clientOrderId")) {
      const existing = await prisma.order.findUnique({
        where: { clientOrderId: clientOrderIdForRecovery },
        select: { orderNumber: true, priceSourceVersion: true },
      });
      if (existing) {
        return jsonWithSecurity(
          {
            requestId,
            orderNumber: existing.orderNumber,
            clientOrderId: clientOrderIdForRecovery,
            duplicate: true,
            priceSourceVersion: existing.priceSourceVersion,
          },
          { status: 200 },
        );
      }
    }

    if (isPrismaUniqueError(error, "orderNumber")) {
      console.error("[POST /api/orders] orderNumber unique collision", {
        requestId,
        priceSourceVersion,
        error,
      });
      return fail({
        requestId,
        code: "DUPLICATE_ORDER_NUMBER",
        error: "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해주세요.",
        status: 409,
        priceSourceVersion,
      });
    }

    if (error instanceof PriceSourceUnavailableError) {
      return fail({
        requestId,
        code: "PRICE_SOURCE_UNAVAILABLE",
        error: "PRICE_SOURCE_UNAVAILABLE",
        status: 503,
        priceSourceVersion,
      });
    }

    if (error instanceof SyntaxError) {
      return fail({
        requestId,
        code: "INVALID_ORDER",
        error: "주문 요청 형식이 올바르지 않습니다.",
        status: 400,
        priceSourceVersion,
      });
    }

    if (error instanceof OrderValidationError) {
      return fail({
        requestId,
        code: error.code,
        error: error.message,
        status: error.status,
        priceSourceVersion: error.priceSourceVersion ?? priceSourceVersion,
        productId: error.productId,
        updatedCart: error.updatedCart,
      });
    }

    console.error("[POST /api/orders]", {
      requestId,
      clientOrderId: clientOrderIdForRecovery,
      priceSourceVersion,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              ...("code" in error ? { code: error.code } : {}),
              ...("meta" in error ? { meta: error.meta } : {}),
            }
          : error,
    });
    return fail({
      requestId,
      code: "SERVER_ERROR",
      error: "주문 처리 중 오류가 발생했습니다.",
      status: 500,
      priceSourceVersion,
    });
  }
}
