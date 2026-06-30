import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/types";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

const ORDER_CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: string;
  deliveryAddress: string;
  pickupTime: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  memo: string | null;
  paymentMethod: string | null;
  outOfStockPolicy: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
    product: {
      barcode: string | null;
    } | null;
  }>;
}) {
  return {
    id: order.id,
    customerName: maskName(order.customerName),
    customerPhone: maskPhone(order.customerPhone),
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: maskAddress(order.deliveryAddress),
    pickupTime: order.pickupTime,
    status: order.status,
    totalAmount: Number(order.totalAmount ?? 0),
    createdAt: order.createdAt.toISOString(),
    memo: order.memo ?? null,
    paymentMethod: order.paymentMethod ?? null,
    outOfStockPolicy: order.outOfStockPolicy ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      price: Number(item.unitPrice ?? 0),
      quantity: Number(item.quantity ?? 0),
      barcode: item.product?.barcode ?? null,
    })),
  };
}

function maskName(name: string): string {
  if (!name) return "";
  if (name.length === 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}`;
}

function maskPhone(phone: string): string {
  const cleaned = normalizePhone(phone);
  if (cleaned.length < 10) return "";
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-****-${cleaned.slice(6)}`;
  }
  return `${cleaned.slice(0, 3)}-****-${cleaned.slice(7)}`;
}

function maskAddress(address: string): string {
  const normalized = address.trim().replace(/\s+/g, " ");
  if (!normalized || normalized === "매장 픽업") return normalized;

  const parts = normalized.split(" ");
  if (parts.length <= 2) {
    return `${parts[0] ?? ""} ***`.trim();
  }

  return `${parts.slice(0, 2).join(" ")} ${"*".repeat(6)}`;
}

function getClientKey(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(req: NextRequest) {
  const now = Date.now();
  const key = getClientKey(req);

  for (const [storedKey, value] of rateLimitStore) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(storedKey);
    }
  }

  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  try {
    const rateLimit = checkRateLimit(req);
    if (rateLimit.limited) {
      logSafeOrderEvent("order.check.failed", {
        requestId,
        reason: "RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        elapsedMs: Date.now() - startedAt,
      }, "warn");

      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "조회 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const orderNumber = String(searchParams.get("orderNumber") ?? query).trim();
    const phone = String(searchParams.get("phone") ?? query).trim();
    const normalizedPhone = normalizePhone(phone);
    const twentyFourHoursAgo = new Date(Date.now() - ORDER_CHECK_WINDOW_MS);

    if (!orderNumber && !normalizedPhone) {
      logSafeOrderEvent("order.check.failed", {
        requestId,
        reason: "QUERY_REQUIRED",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "QUERY_REQUIRED" }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        OR: [
          ...(orderNumber ? [{ orderNumber }] : []),
          ...(normalizedPhone
            ? [
                {
                  customerPhone: {
                    contains: normalizedPhone.slice(-4),
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                barcode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredOrders = normalizedPhone
      ? orders.filter(
          (order) =>
            order.orderNumber === orderNumber ||
            normalizePhone(order.customerPhone) === normalizedPhone,
        )
      : orders;

    logSafeOrderEvent("order.check.succeeded", {
      requestId,
      queryType: normalizedPhone ? "phone" : "orderNumber",
      resultCount: filteredOrders.length,
      windowHours: 24,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({ orders: filteredOrders.map(serializeOrder) });
  } catch (error) {
    logSafeOrderError("order.check.failed", {
      requestId,
      reason: "ORDER_CHECK_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json(
      {
        error: "ORDER_CHECK_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
