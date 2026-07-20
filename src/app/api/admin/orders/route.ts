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
const CANCELLED_ITEM_STATUS = "CANCELLED";

function priceNameByBarcode(barcode: string | null | undefined, priceMap: PriceNameMap) {
  const normalizedBarcode = barcode?.trim();
  if (!normalizedBarcode) return undefined;

  return priceMap.get(normalizedBarcode)?.name;
}

function isActiveOrderItem(item: { itemStatus?: string | null }) {
  return item.itemStatus !== CANCELLED_ITEM_STATUS;
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
    itemStatus?: string | null;
    product?: {
      name?: string;
      barcode?: string | null;
      category?: string | null;
    } | null;
  }>;
}, priceMap: PriceNameMap = new Map()) {
  const activeTotalAmount = (order.items || []).reduce((sum, item) => {
    if (!isActiveOrderItem(item)) return sum;
    return sum + Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? 0);
  }, 0);

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
    totalAmount: activeTotalAmount,
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
        itemStatus: isActiveOrderItem(item) ? "ACTIVE" : "CANCELLED",
        product: item.product
          ? {
              name: firstMeaningfulProductName(item.product.name, syncedName) || productName,
              barcode: item.product.barcode,
              category: item.product.category ?? null,
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

    const orderWhere = Object.keys(where).length > 0 ? where : undefined;
    const [orders, totalOrderCount, statusCounts] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count(),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

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
      totalOrderCount,
      filteredOutByOrderWhere: Math.max(totalOrderCount - orders.length, 0),
      statusCounts: Object.fromEntries(
        statusCounts.map((row) => [row.status, row._count._all]),
      ),
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
