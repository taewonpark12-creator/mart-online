import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getKoreaDateRangeUtc } from "@/lib/korea-date";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";
import { firstMeaningfulProductName } from "@/lib/order-item";
import { loadPriceSource } from "@/lib/order-pricing";

const allowedStatuses = [
  "PENDING",
  "APPROVED",
  "DELIVERED",
  "CANCELLED",
];

type PriceNameMap = Map<string, { name?: string }>;

function priceNameByBarcode(barcode: string | null | undefined, priceMap: PriceNameMap) {
  const normalizedBarcode = barcode?.trim();
  if (!normalizedBarcode) return undefined;

  return priceMap.get(normalizedBarcode)?.name;
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: string;
  deliveryAddress: string;
  deliveryEntrance: string | null;
  pickupTime: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  memo?: string | null;
  paymentMethod?: string | null;
  outOfStockPolicy?: string | null;
  items?: Array<{
    id: string;
    productId: string | null;
    productName?: string;
    name?: string;
    unitPrice?: number;
    price?: number;
    quantity?: number;
    product?: {
      name?: string;
      barcode?: string | null;
    } | null;
  }>;
}, priceMap: PriceNameMap = new Map()) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: order.deliveryAddress,
    deliveryEntrance: order.deliveryEntrance,
    pickupTime: order.pickupTime,
    status: order.status,
    totalAmount: Number(order.totalAmount ?? 0),
    createdAt: order.createdAt.toISOString(),
    memo: order.memo ?? null,
    paymentMethod: order.paymentMethod ?? null,
    outOfStockPolicy: order.outOfStockPolicy ?? null,
    items: (order.items || []).map((item) => {
      const barcode = item.product?.barcode ?? null;
      const syncedName = priceNameByBarcode(barcode, priceMap);
      const productName =
        firstMeaningfulProductName(item.productName, syncedName, item.product?.name, item.name) || "상품명 없음";

      return {
        id: item.id,
        productId: item.productId,
        productName,
        unitPrice: Number(item.unitPrice ?? item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        product: item.product
          ? {
              name: firstMeaningfulProductName(item.product.name, syncedName) || productName,
              barcode: item.product.barcode,
            }
          : undefined,
      };
    }),
  };
}

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  try {
    if (!(await isAdminAuthenticated())) {
      logSafeOrderEvent("admin.orders.list.failed", {
        requestId,
        reason: "AUTH_REQUIRED",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (status && !allowedStatuses.includes(status)) {
      logSafeOrderEvent("admin.orders.list.failed", {
        requestId,
        reason: "INVALID_STATUS_FILTER",
        status,
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json(
        {
          error: "INVALID_STATUS_FILTER",
          message: `허용되지 않은 주문상태 필터입니다: ${status}`,
          allowedStatuses,
        },
        { status: 400 },
      );
    }

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      const { startUtc, endUtc } = getKoreaDateRangeUtc(startDate, endDate);
      where.createdAt = {};
      if (startUtc) {
        where.createdAt.gte = startUtc;
      }
      if (endUtc) {
        where.createdAt.lte = endUtc;
      }
    }

    const orders = await prisma.order.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });

    let priceMap: PriceNameMap = new Map();
    try {
      priceMap = (await loadPriceSource()).priceMap;
    } catch {
      priceMap = new Map();
    }

    const serializedOrders = orders.map((order) => serializeOrder(order, priceMap));
    logSafeOrderEvent("admin.orders.list.succeeded", {
      requestId,
      count: serializedOrders.length,
      statusFilter: status || null,
      hasDateFilter: Boolean(startDate || endDate),
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(serializedOrders);
  } catch (error) {
    logSafeOrderError("admin.orders.list.failed", {
      requestId,
      reason: "ADMIN_ORDERS_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json(
      {
        error: "ADMIN_ORDERS_ERROR",
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
      },
      { status: 500 },
    );
  }
}
