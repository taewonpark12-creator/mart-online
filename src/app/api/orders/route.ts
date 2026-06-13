import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];
const PICKUP_TIME_VALUES = new Set(PICKUP_TIME_SLOTS.map((s) => s.value));
const PRICE_CHANGED_MESSAGE = "상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.";

type SubmittedOrderItem = {
  productId?: unknown;
  barcode?: unknown;
  name?: unknown;
  price?: unknown;
  quantity?: unknown;
};

type PriceItem = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice: number | null;
  discountRate?: number | null;
};

function toSafePrice(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

class OrderValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

async function loadPriceMap() {
  try {
    const filePath = path.join(process.cwd(), "public", "prices.json");
    const raw = await readFile(filePath, "utf8");
    const prices = JSON.parse(raw) as unknown;
    if (!Array.isArray(prices)) {
      return new Map<string, PriceItem>();
    }

    const map = new Map<string, PriceItem>();
    for (const item of prices) {
      if (!item || typeof item !== "object") continue;
      const priceItem = item as Partial<PriceItem>;
      const barcode = String(priceItem.barcode ?? "").trim();
      const normalPrice = Number(priceItem.normalPrice);
      if (!barcode || !Number.isFinite(normalPrice)) continue;

      map.set(barcode, {
        barcode,
        name: typeof priceItem.name === "string" ? priceItem.name : undefined,
        normalPrice,
        eventPrice:
          priceItem.eventPrice !== null && priceItem.eventPrice !== undefined
            ? Number(priceItem.eventPrice)
            : null,
        discountRate:
          priceItem.discountRate !== null && priceItem.discountRate !== undefined
            ? Number(priceItem.discountRate)
            : null,
      });
    }

    return map;
  } catch (error) {
    console.error("[POST /api/orders] Failed to load prices.json", error);
    return new Map<string, PriceItem>();
  }
}

function getDiscountRate(priceInfo: PriceItem, normalPrice: number, eventPrice: number | null) {
  if (priceInfo.discountRate !== null && priceInfo.discountRate !== undefined) {
    return Number(priceInfo.discountRate);
  }

  if (eventPrice && eventPrice > 0 && eventPrice < normalPrice) {
    return Math.round((1 - eventPrice / normalPrice) * 100);
  }

  return null;
}

function getSyncedProductInfo(
  product: {
    name: string;
    barcode: string | null;
    price: bigint | number;
  },
  priceMap: Map<string, PriceItem>,
) {
  const barcode = product.barcode?.trim();
  const priceInfo = barcode ? priceMap.get(barcode) : undefined;

  if (!priceInfo) {
    const dbPrice = toSafePrice(product.price);
    return {
      name: product.name,
      price: dbPrice,
      normalPrice: dbPrice,
      eventPrice: null,
      discountRate: null,
    };
  }

  const dbPrice = toSafePrice(product.price);
  const normalPrice = toSafePrice(priceInfo.normalPrice, dbPrice);
  const eventPrice =
    priceInfo.eventPrice !== null && priceInfo.eventPrice !== undefined
      ? toSafePrice(priceInfo.eventPrice, 0)
      : null;
  const discountRate = getDiscountRate(priceInfo, normalPrice, eventPrice);
  const hasEvent = eventPrice !== null && eventPrice > 0 && discountRate !== null && discountRate > 0;

  return {
    name: priceInfo.name || product.name,
    price: hasEvent ? eventPrice : normalPrice,
    normalPrice,
    eventPrice,
    discountRate,
  };
}

function parseSubmittedItem(item: SubmittedOrderItem) {
  const productId = typeof item.productId === "string" ? item.productId.trim() : "";
  const barcode = typeof item.barcode === "string" ? item.barcode.trim() : null;
  const price = Number(item.price);
  const quantity = Number(item.quantity);

  if (!productId) {
    throw new OrderValidationError("유효하지 않은 상품이 포함되어 있습니다.");
  }
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
    throw new OrderValidationError(PRICE_CHANGED_MESSAGE, 409);
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new OrderValidationError("상품 수량을 다시 확인해주세요.");
  }

  return { productId, barcode, price, quantity };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
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

    if (!VALID_FULFILLMENT.includes(rawFulfillment)) {
      return NextResponse.json({ error: "수령 방식을 올바르게 선택해주세요." }, { status: 400 });
    }

    const fulfillmentType: FulfillmentType = rawFulfillment;

    const safeCustomerName = sanitizeInput(String(customerName ?? ""));
    const safeCustomerPhone = sanitizeInput(String(customerPhone ?? ""));
    const safeDeliveryAddress = sanitizeInput(String(deliveryAddress ?? ""));
    const safeDeliveryEntrance = sanitizeInput(String(deliveryEntrance ?? ""));
    const safePickupTime = sanitizeInput(String(pickupTime ?? ""));
    const safeMemo = sanitizeInput(String(memo ?? ""));

    if (!safeCustomerName || !validateName(safeCustomerName)) {
      return NextResponse.json({ error: "유효하지 않은 이름입니다." }, { status: 400 });
    }

    if (!safeCustomerPhone || !validatePhoneNumber(safeCustomerPhone)) {
      return NextResponse.json({ error: "유효하지 않은 연락처입니다." }, { status: 400 });
    }

    if (!VALID_FULFILLMENT.includes(fulfillmentType)) {
      return NextResponse.json({ error: "수령 방식이 올바르지 않습니다." }, { status: 400 });
    }

    if (fulfillmentType === "DELIVERY") {
      if (!safeDeliveryAddress || !validateAddress(safeDeliveryAddress)) {
        return NextResponse.json({ error: "유효하지 않은 배달 주소입니다." }, { status: 400 });
      }
      if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
        return NextResponse.json({ error: "결제 방법을 선택해 주세요." }, { status: 400 });
      }
    } else {
      const time = safePickupTime;
      if (!time || !PICKUP_TIME_VALUES.has(time)) {
        return NextResponse.json({ error: "픽업 예정 시간을 선택해 주세요." }, { status: 400 });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "주문 상품이 없습니다." }, { status: 400 });
    }

    if (
      submittedTotalAmount !== undefined &&
      (!Number.isFinite(Number(submittedTotalAmount)) || Number(submittedTotalAmount) < 0)
    ) {
      return NextResponse.json({ error: "주문 금액을 다시 확인해주세요." }, { status: 400 });
    }

    const submittedItems = items.map(parseSubmittedItem);
    const productIds = submittedItems.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json({ error: "중복된 상품이 포함되어 있습니다. 장바구니를 다시 확인해주세요." }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "유효하지 않은 상품이 포함되어 있습니다." }, { status: 400 });
    }

    const priceMap = await loadPriceMap();
    const productMap = new Map(products.map((product) => [product.id, product]));
    let totalAmount = 0;

    const orderItems = submittedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new OrderValidationError("유효하지 않은 상품이 포함되어 있습니다.");
      }

      const currentBarcode = product.barcode?.trim() || null;
      if (currentBarcode && item.barcode !== currentBarcode) {
        throw new OrderValidationError("상품 정보가 변경되었습니다. 장바구니를 다시 확인해주세요.");
      }
      if (!currentBarcode && item.barcode) {
        throw new OrderValidationError("상품 정보가 변경되었습니다. 장바구니를 다시 확인해주세요.");
      }

      if (product.isOutOfStock) {
        throw new OrderValidationError("품절된 상품이 포함되어 있습니다. 장바구니를 다시 확인해주세요.");
      }

      const maxOrderQuantity =
        product.maxOrderQuantity && product.maxOrderQuantity > 0 ? product.maxOrderQuantity : null;
      if (maxOrderQuantity && item.quantity > maxOrderQuantity) {
        throw new OrderValidationError(`해당 상품은 최대 ${maxOrderQuantity}개까지 구매 가능합니다.`);
      }

      const synced = getSyncedProductInfo(product, priceMap);
      if (item.price !== synced.price) {
        throw new OrderValidationError(PRICE_CHANGED_MESSAGE, 409);
      }

      totalAmount += synced.price * item.quantity;

      return {
        productId: product.id,
        productName: synced.name,
        quantity: item.quantity,
        unitPrice: synced.price,
      };
    });

    if (totalAmount < MIN_ORDER_AMOUNT) {
      return NextResponse.json(
        { error: `최소 주문 금액은 ${MIN_ORDER_AMOUNT.toLocaleString("ko-KR")}원입니다.` },
        { status: 400 },
      );
    }

    if (
      submittedTotalAmount !== undefined &&
      Math.floor(Number(submittedTotalAmount)) !== totalAmount
    ) {
      return NextResponse.json({ error: PRICE_CHANGED_MESSAGE }, { status: 409 });
    }

    const isPickup = fulfillmentType === "PICKUP";
    const order = await prisma.order.create({
      data: {
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
        totalAmount,
        items: { create: orderItems },
      },
    });

    await createAuditLog({
      action: "CREATE",
      entity: "Order",
      entityId: order.id,
      changes: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        itemCount: orderItems.length,
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    const response = NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
    Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error("[POST /api/orders]", error);

    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "주문 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
