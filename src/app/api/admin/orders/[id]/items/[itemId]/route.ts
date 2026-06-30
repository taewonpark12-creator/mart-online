import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type Params = { params: Promise<{ id: string; itemId: string }> };

const ACTIVE_ITEM_STATUS = "ACTIVE";
const CANCELLED_ITEM_STATUS = "CANCELLED";

function activeItemTotal(items: Array<{ unitPrice: number; quantity: number; itemStatus?: string | null }>) {
  return items.reduce((sum, item) => {
    if (item.itemStatus === CANCELLED_ITEM_STATUS) return sum;
    return sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0);
  }, 0);
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
  memo: string | null;
  paymentMethod: string | null;
  outOfStockPolicy: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    itemStatus?: string | null;
    product: { name: string; barcode: string | null } | null;
  }>;
}) {
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
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      itemStatus: item.itemStatus === CANCELLED_ITEM_STATUS ? CANCELLED_ITEM_STATUS : ACTIVE_ITEM_STATUS,
      product: item.product
        ? {
            name: item.product.name,
            barcode: item.product.barcode,
          }
        : undefined,
    })),
  };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    logSafeOrderEvent("admin.order.item_status_change.failed", {
      requestId,
      reason: "AUTH_REQUIRED",
      elapsedMs: Date.now() - startedAt,
    }, "warn");
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const { id, itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const nextStatus = body?.itemStatus === CANCELLED_ITEM_STATUS ? CANCELLED_ITEM_STATUS : "";

    if (nextStatus !== CANCELLED_ITEM_STATUS) {
      return NextResponse.json({ error: "INVALID_ITEM_STATUS" }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: itemId,
          orderId: id,
        },
        select: {
          id: true,
          itemStatus: true,
        },
      });

      if (!item) return null;

      if (item.itemStatus !== CANCELLED_ITEM_STATUS) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { itemStatus: CANCELLED_ITEM_STATUS },
        });
      }

      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: {
          unitPrice: true,
          quantity: true,
          itemStatus: true,
        },
      });

      const totalAmount = activeItemTotal(items);

      return tx.order.update({
        where: { id },
        data: { totalAmount },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  barcode: true,
                },
              },
            },
          },
        },
      });
    });

    if (!order) {
      logSafeOrderEvent("admin.order.item_status_change.failed", {
        requestId,
        orderId: id,
        orderItemId: itemId,
        reason: "ORDER_ITEM_NOT_FOUND",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "ORDER_ITEM_NOT_FOUND" }, { status: 404 });
    }

    logSafeOrderEvent("admin.order.item_status_change.succeeded", {
      requestId,
      orderId: id,
      orderItemId: itemId,
      nextItemStatus: CANCELLED_ITEM_STATUS,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(serializeOrder(order));
  } catch (error) {
    logSafeOrderError("admin.order.item_status_change.failed", {
      requestId,
      reason: "SERVER_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ error: "ITEM_STATUS_UPDATE_FAILED" }, { status: 500 });
  }
}
