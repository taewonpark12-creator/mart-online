import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getKoreaDateRangeUtc } from "@/lib/korea-date";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

const allowedStatuses = [
  "PENDING",
  "APPROVED",
  "DELIVERED",
  "CANCELLED",
];

function serializeOrder(order: {
  id: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  items?: Array<{
    itemStatus?: string | null;
    cancelledQuantity?: number | null;
  }>;
}) {
  const hasCancelledItems = (order.items || []).some((item) => item.itemStatus === "CANCELLED" || (item.cancelledQuantity ?? 0) > 0);

  return {
    id: order.id,
    orderNumber: "",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: "",
    deliveryEntrance: null,
    pickupTime: null,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt.toISOString(),
    memo: null,
    paymentMethod: null,
    outOfStockPolicy: null,
    items: (order.items || []).map((item) => ({
      id: "",
      productId: null,
      productName: "",
      unitPrice: 0,
      quantity: 0,
      cancelledQuantity: Number(item.cancelledQuantity ?? 0),
      itemStatus: item.itemStatus === "CANCELLED" ? "CANCELLED" : "ACTIVE",
      product: undefined,
    })),
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
    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        fulfillmentType: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            itemStatus: true,
            cancelledQuantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      // If the error is related to cancelledQuantity column not existing, provide a clear message
      if (error instanceof Error && error.message.includes('cancelledQuantity')) {
        throw new Error("DATABASE_SCHEMA_MISMATCH: cancelledQuantity column does not exist. Please run the migration: ALTER TABLE \"OrderItem\" ADD COLUMN \"cancelledQuantity\" INTEGER NOT NULL DEFAULT 0");
      }
      throw error;
    });

    const serializedOrders = orders.map((order) => serializeOrder(order));
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
