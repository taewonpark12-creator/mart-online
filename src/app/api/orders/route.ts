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

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  let priceSourceVersion: string | undefined;
  let clientOrderIdForRecovery: string | undefined;

  try {
    const body = await req.json();
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

      return tx.order.create({
        data: {
          clientOrderId,
          priceSourceVersion: validated.priceSourceVersion,
          orderNumber: generateOrderNumber(),
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
    if (
      clientOrderIdForRecovery &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
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

    if (error instanceof PriceSourceUnavailableError) {
      return fail({
        requestId,
        code: "PRICE_SOURCE_UNAVAILABLE",
        error: "PRICE_SOURCE_UNAVAILABLE",
        status: 503,
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

    console.error("[POST /api/orders]", { requestId, error });
    return fail({
      requestId,
      code: "SERVER_ERROR",
      error: "주문 처리 중 오류가 발생했습니다.",
      status: 500,
      priceSourceVersion,
    });
  }
}
