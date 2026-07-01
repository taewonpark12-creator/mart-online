import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAfterCutoffTime } from "@/lib/delivery-schedule";
import { sendNewOrderTelegramAlert } from "@/lib/telegram";
import { generateOrderNumber } from "@/lib/types";
import {
  PriceSourceUnavailableError,
  getSyncedProductInfo,
  loadPriceSource,
} from "@/lib/order-pricing";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";
import { firstMeaningfulProductName } from "@/lib/order-item";

export const runtime = "nodejs";

type FulfillmentType = "DELIVERY" | "PICKUP";
type PaymentMethod = "ONSITE_CARD" | "ONSITE_CASH" | "BANK_TRANSFER";
type OutOfStockPolicy = "SUBSTITUTE" | "CANCEL_ONLY" | "CONTACT";
type OrderItemInput = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

type ValidatedOrderItem = OrderItemInput & {
  barcode: string | null;
};

const DUPLICATE_ORDER_WINDOW_MS = 2 * 60 * 1000;
const PAYMENT_METHODS = new Set<PaymentMethod>([
  "ONSITE_CARD",
  "ONSITE_CASH",
  "BANK_TRANSFER",
]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function asPaymentMethod(value: unknown) {
  return typeof value === "string" && PAYMENT_METHODS.has(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function itemSignature(items: OrderItemInput[]) {
  return items
    .map((item) => `${item.productId}:${item.price}:${item.quantity}`)
    .sort()
    .join("|");
}

function orderItemSignature(
  items: Array<{ productId: string | null; unitPrice: number; quantity: number }>,
) {
  return items
    .map((item) => `${item.productId ?? ""}:${item.unitPrice}:${item.quantity}`)
    .sort()
    .join("|");
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let body: Record<string, unknown>;

  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object") {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_BODY",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_JSON",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const customerName = asString(body.customerName);
    const customerPhone = asString(body.customerPhone);
    const fulfillmentType = body.fulfillmentType as FulfillmentType;
    const deliveryAddress = asString(body.deliveryAddress);
    const pickupTime = asString(body.pickupTime);
    const memo = asString(body.memo);
    const outOfStockPolicy = (body.outOfStockPolicy as OutOfStockPolicy) || "CONTACT";
    const submittedPaymentMethod = asPaymentMethod(body.paymentMethod);
    const paymentMethod =
      submittedPaymentMethod ?? (fulfillmentType === "DELIVERY" ? "ONSITE_CASH" : null);

    if (!customerName || !customerPhone) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "MISSING_CUSTOMER_INFO",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "MISSING_CUSTOMER_INFO" }, { status: 400 });
    }

    if (fulfillmentType !== "DELIVERY" && fulfillmentType !== "PICKUP") {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_FULFILLMENT_TYPE",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_FULFILLMENT_TYPE" }, { status: 400 });
    }

    if (fulfillmentType === "DELIVERY" && !deliveryAddress) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "MISSING_DELIVERY_ADDRESS",
        fulfillmentType,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "MISSING_DELIVERY_ADDRESS" }, { status: 400 });
    }

    if (fulfillmentType === "PICKUP" && !pickupTime) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "MISSING_PICKUP_TIME",
        fulfillmentType,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "MISSING_PICKUP_TIME" }, { status: 400 });
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_ITEMS",
        itemCount: 0,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const items = body.items.map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const productId = asString(item.productId);
      const productName = asString(item.productName) || asString(item.name);
      const price = asNumber(item.price);
      const quantity = asNumber(item.quantity);

      if (
        !productId ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return null;
      }

      return {
        productId,
        productName,
        price,
        quantity,
      };
    });

    if (items.some((item) => item === null)) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_ITEMS",
        itemCount: Array.isArray(body.items) ? body.items.length : 0,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const submittedOrderItems = items as OrderItemInput[];
    const productIds = submittedOrderItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        isActive: true,
        isOutOfStock: true,
        maxOrderQuantity: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const { priceMap } = await loadPriceSource();

    const unavailableItems: Array<{
      productId: string;
      productName: string;
      reason: string;
    }> = [];
    const priceChangedItems: Array<{
      productId: string;
      productName: string;
      previousPrice: number;
      currentPrice: number;
      message: string;
    }> = [];
    const orderItems: ValidatedOrderItem[] = [];

    for (const item of submittedOrderItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        unavailableItems.push({
          productId: item.productId,
          productName: firstMeaningfulProductName(item.productName) || "상품명 없음",
          reason: "상품을 찾을 수 없습니다.",
        });
        continue;
      }

      if (!product.isActive || product.isOutOfStock) {
        unavailableItems.push({
          productId: item.productId,
          productName: firstMeaningfulProductName(item.productName, product.name) || "상품명 없음",
          reason: !product.isActive ? "현재 판매하지 않는 상품입니다." : "품절된 상품입니다.",
        });
        continue;
      }

      if (product.maxOrderQuantity && product.maxOrderQuantity > 0 && item.quantity > product.maxOrderQuantity) {
        unavailableItems.push({
          productId: item.productId,
          productName: firstMeaningfulProductName(item.productName, product.name) || "상품명 없음",
          reason: `최대 ${product.maxOrderQuantity}개까지 주문 가능합니다.`,
        });
        continue;
      }

      const syncedProduct = getSyncedProductInfo(product, priceMap);
      const currentPrice = Number(syncedProduct.price);
      const displayProductName =
        firstMeaningfulProductName(item.productName, syncedProduct.name, product.name) || "상품명 없음";

      if (!Number.isFinite(currentPrice) || currentPrice < 0) {
        unavailableItems.push({
          productId: item.productId,
          productName: displayProductName,
          reason: "상품 가격을 확인할 수 없습니다.",
        });
        continue;
      }

      if (item.price !== currentPrice) {
        priceChangedItems.push({
          productId: item.productId,
          productName: displayProductName,
          previousPrice: item.price,
          currentPrice,
          message: `${displayProductName}: ${formatPrice(item.price)} → ${formatPrice(currentPrice)}`,
        });
        continue;
      }

      orderItems.push({
        productId: item.productId,
        productName: displayProductName,
        barcode: syncedProduct.barcode,
        price: currentPrice,
        quantity: item.quantity,
      });
    }

    if (unavailableItems.length > 0) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "UNAVAILABLE_ORDER_ITEMS",
        unavailableCount: unavailableItems.length,
        itemCount: submittedOrderItems.length,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json(
        {
          error: "UNAVAILABLE_ORDER_ITEMS",
          message: "주문할 수 없는 상품이 포함되어 있습니다.",
          unavailableItems,
        },
        { status: 409 },
      );
    }

    if (priceChangedItems.length > 0) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "PRICE_CHANGED",
        changedCount: priceChangedItems.length,
        itemCount: submittedOrderItems.length,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json(
        {
          error: "PRICE_CHANGED",
          message: "상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.",
          changedItems: priceChangedItems,
        },
        { status: 409 },
      );
    }

    if (orderItems.length !== submittedOrderItems.length) {
      logSafeOrderEvent("order.create.failed", {
        requestId,
        reason: "INVALID_ITEMS",
        itemCount: submittedOrderItems.length,
        validItemCount: orderItems.length,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const acceptedAt = new Date();
    const acceptedAfterCutoff = isAfterCutoffTime(acceptedAt);
    const duplicateWindowStart = new Date(acceptedAt.getTime() - DUPLICATE_ORDER_WINDOW_MS);
    const normalizedCustomerPhone = normalizePhone(customerPhone);
    const requestItemSignature = itemSignature(orderItems);
    const duplicateLockKey = [
      normalizedCustomerPhone || customerPhone,
      totalAmount,
      requestItemSignature,
    ].join("|");

    const orderResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('order-create-v1'), hashtext(${duplicateLockKey}))
      `;

      const recentOrders = await tx.order.findMany({
        where: {
          totalAmount,
          createdAt: {
            gte: duplicateWindowStart,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customerPhone: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      });

      const duplicateOrder = recentOrders.find((order) => {
        return (
          normalizePhone(order.customerPhone) === normalizedCustomerPhone &&
          orderItemSignature(order.items) === requestItemSignature
        );
      });

      if (duplicateOrder) {
        return {
          order: duplicateOrder,
          duplicate: true,
        };
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName,
          customerPhone,
          fulfillmentType,
          deliveryAddress:
            fulfillmentType === "DELIVERY" ? deliveryAddress : "매장 픽업",
          pickupTime: fulfillmentType === "PICKUP" ? pickupTime : null,
          memo: memo || null,
          paymentMethod,
          outOfStockPolicy,
          totalAmount,
          createdAt: acceptedAt,
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.price,
            })),
          },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      });

      return {
        order,
        duplicate: false,
      };
    });

    const { order, duplicate } = orderResult;

    if (duplicate) {
      logSafeOrderEvent("order.create.duplicate_suppressed", {
        requestId,
        orderId: order.id,
        totalAmount,
        itemCount: orderItems.length,
        elapsedMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        acceptedAfterCutoff: isAfterCutoffTime(order.createdAt),
        duplicate: true,
      });
    }

    logSafeOrderEvent("order.create.succeeded", {
      requestId,
      orderId: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      itemCount: orderItems.length,
      fulfillmentType,
      acceptedAfterCutoff,
      elapsedMs: Date.now() - startedAt,
    });

    try {
      await sendNewOrderTelegramAlert();
    } catch (error) {
      logSafeOrderError("order.create.telegram_alert_failed", {
        requestId,
        orderId: order.id,
      }, error);
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      acceptedAfterCutoff,
    });
  } catch (error) {
    if (error instanceof PriceSourceUnavailableError) {
      logSafeOrderError("order.create.failed", {
        requestId,
        reason: "PRICE_SOURCE_UNAVAILABLE",
        elapsedMs: Date.now() - startedAt,
      }, error);
      return NextResponse.json(
        {
          error: "PRICE_SOURCE_UNAVAILABLE",
          message: "상품 가격 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: error.status },
      );
    }

    logSafeOrderError("order.create.failed", {
      requestId,
      reason: "ORDER_CREATE_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);

    return NextResponse.json(
      {
        error: "ORDER_CREATE_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
