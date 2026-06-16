import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store";
import {
  generateOrderNumber,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";
import { getSecurityHeaders, sanitizeInput } from "@/lib/security";

export const runtime = "nodejs";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];

type NormalizedOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

function jsonWithSecurity(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function validationError(message: string) {
  return jsonWithSecurity({ error: message }, { status: 400 });
}

function dbError(error: unknown) {
  console.error("[ORDER_DB_ERROR]", error);
  return jsonWithSecurity({ error: "주문 저장 중 오류가 발생했습니다." }, { status: 500 });
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function normalizeItems(rawItems: unknown) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    console.log("[ORDER_VALIDATE_FAIL]", {
      reason: "items_missing_or_empty",
      field: "items",
      value: rawItems,
    });
    return null;
  }

  const normalizedItems: NormalizedOrderItem[] = [];

  for (const [index, rawItem] of rawItems.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      console.log("[ORDER_VALIDATE_FAIL]", {
        reason: "item_not_object",
        field: `items[${index}]`,
        value: rawItem,
      });
      return null;
    }

    const item = rawItem as Record<string, unknown>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const price = Number(toFiniteNumber(item.price));
    const quantity = Number(toFiniteNumber(item.quantity));

    if (!productId) {
      console.log("[ORDER_VALIDATE_FAIL]", {
        reason: "missing_product_id",
        field: `items[${index}].productId`,
        value: item.productId,
      });
      return null;
    }

    if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
      console.log("[ORDER_VALIDATE_FAIL]", {
        reason: "invalid_price",
        field: `items[${index}].price`,
        value: item.price,
      });
      return null;
    }

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      console.log("[ORDER_VALIDATE_FAIL]", {
        reason: "invalid_quantity",
        field: `items[${index}].quantity`,
        value: item.quantity,
      });
      return null;
    }

    normalizedItems.push({
      productId,
      productName: sanitizeInput(String(item.name ?? "")) || productId,
      quantity,
      unitPrice: price,
    });
  }

  return normalizedItems;
}

function getFulfillmentType(value: unknown): FulfillmentType {
  return typeof value === "string" && VALID_FULFILLMENT.includes(value as FulfillmentType)
    ? (value as FulfillmentType)
    : "DELIVERY";
}

function getPaymentMethod(value: unknown): PaymentMethod | null {
  return typeof value === "string" && VALID_PAYMENT.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch (error) {
    console.log("[ORDER_JSON_PARSE_ERROR]", error);
    return validationError("INVALID_JSON");
  }

  console.log("[ORDER_DEBUG_BODY]", body);

  if (!body || typeof body !== "object") {
    console.log("[ORDER_VALIDATE_FAIL]", {
      reason: "body_missing_or_invalid",
      field: "body",
      value: body,
    });
    return validationError("주문 요청 형식이 올바르지 않습니다.");
  }

  const orderBody = body as Record<string, unknown>;

  if (!orderBody.items) {
    console.log("[ORDER_VALIDATE_FAIL]", {
      reason: "items_missing",
      field: "items",
      value: orderBody.items,
    });
    return validationError("주문 상품이 없습니다.");
  }

  const items = normalizeItems(orderBody.items);
  if (!items) {
    return validationError("주문 상품을 다시 확인해주세요.");
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
    console.log("[ORDER_VALIDATE_FAIL]", {
      reason: "invalid_total_amount",
      field: "items",
      value: totalAmount,
    });
    return validationError("주문 금액을 다시 확인해주세요.");
  }

  const fulfillmentType = getFulfillmentType(orderBody.fulfillmentType);
  const isPickup = fulfillmentType === "PICKUP";
  const customerName = sanitizeInput(String(orderBody.customerName ?? ""));
  const customerPhone = sanitizeInput(String(orderBody.customerPhone ?? ""));
  const deliveryAddress = sanitizeInput(String(orderBody.deliveryAddress ?? ""));
  const deliveryEntrance = sanitizeInput(String(orderBody.deliveryEntrance ?? ""));
  const pickupTime = sanitizeInput(String(orderBody.pickupTime ?? ""));
  const memo = sanitizeInput(String(orderBody.memo ?? ""));
  const paymentMethod = isPickup ? null : getPaymentMethod(orderBody.paymentMethod);

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: "PENDING",
        customerName,
        customerPhone,
        fulfillmentType,
        deliveryAddress: isPickup ? `매장 픽업 · ${STORE.name}` : deliveryAddress,
        deliveryEntrance: isPickup ? null : deliveryEntrance || null,
        pickupTime: isPickup ? pickupTime || null : null,
        memo: memo || null,
        paymentMethod,
        totalAmount,
        items: {
          create: items,
        },
      },
      select: {
        orderNumber: true,
        status: true,
        totalAmount: true,
      },
    });

    return jsonWithSecurity(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
      },
      { status: 201 },
    );
  } catch (error) {
    return dbError(error);
  }
}
