import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { createRequestId, logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type Params = { params: Promise<{ id: string; itemId: string }> };

const ACTIVE_ITEM_STATUS = "ACTIVE";
const CANCELLED_ITEM_STATUS = "CANCELLED";

function activeItemTotal(items: Array<{ unitPrice: number; quantity: number; cancelledQuantity?: number; itemStatus?: string | null }>) {
  return items.reduce((sum, item) => {
    // For fully cancelled items (itemStatus = CANCELLED), active quantity is always 0 regardless of cancelledQuantity value
    // This ensures compatibility with legacy data where cancelledQuantity might be 0 for fully cancelled items
    if (item.itemStatus === CANCELLED_ITEM_STATUS) return sum;
    const activeQuantity = Number(item.quantity ?? 0) - Number(item.cancelledQuantity ?? 0);
    return sum + Number(item.unitPrice ?? 0) * activeQuantity;
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
    cancelledQuantity: number;
    unitPrice: number;
    itemStatus?: string | null;
    product: { name: string; barcode: string | null; category: string | null } | null;
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
      cancelledQuantity: Number(item.cancelledQuantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      itemStatus: item.itemStatus === CANCELLED_ITEM_STATUS ? CANCELLED_ITEM_STATUS : ACTIVE_ITEM_STATUS,
      product: item.product
        ? {
            name: item.product.name,
            barcode: item.product.barcode,
            category: item.product.category,
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

  const { id, itemId } = await params;
  
  try {
    const body = await req.json().catch(() => ({}));
    const nextStatus = body?.itemStatus === CANCELLED_ITEM_STATUS ? CANCELLED_ITEM_STATUS : "";
    const cancelQuantity = body?.cancelledQuantity ? Number(body.cancelledQuantity) : 0;

    if (nextStatus !== CANCELLED_ITEM_STATUS) {
      return NextResponse.json({ error: "INVALID_ITEM_STATUS" }, { status: 400 });
    }

    // Validate cancellation quantity before transaction
    // Must be a positive integer (reject 0, negative, decimals, NaN, non-numeric strings)
    if (!Number.isInteger(cancelQuantity) || cancelQuantity <= 0) {
      return NextResponse.json({ error: "INVALID_CANCEL_QUANTITY" }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: itemId,
          orderId: id,
        },
        select: {
          id: true,
          quantity: true,
          cancelledQuantity: true,
          itemStatus: true,
        },
      });

      if (!item) return null;

      const currentCancelled = Number(item.cancelledQuantity ?? 0);
      const totalQuantity = Number(item.quantity ?? 0);
      const remainingActive = totalQuantity - currentCancelled;

      if (cancelQuantity > remainingActive) {
        throw new Error("CANCEL_QUANTITY_EXCEEDS_ACTIVE");
      }

      // If cancelling all remaining items, set status to CANCELLED
      const newCancelledQuantity = currentCancelled + cancelQuantity;
      const isFullyCancelled = newCancelledQuantity >= totalQuantity;

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          cancelledQuantity: newCancelledQuantity,
          itemStatus: isFullyCancelled ? CANCELLED_ITEM_STATUS : ACTIVE_ITEM_STATUS,
        },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: {
          unitPrice: true,
          quantity: true,
          cancelledQuantity: true,
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
                    category: true,
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
      cancelQuantity,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json(serializeOrder(order));
  } catch (error) {
    if (error instanceof Error && error.message === "CANCEL_QUANTITY_EXCEEDS_ACTIVE") {
      logSafeOrderEvent("admin.order.item_status_change.failed", {
        requestId,
        orderId: id,
        orderItemId: itemId,
        reason: "CANCEL_QUANTITY_EXCEEDS_ACTIVE",
        elapsedMs: Date.now() - startedAt,
      }, "warn");
      return NextResponse.json({ error: "CANCEL_QUANTITY_EXCEEDS_ACTIVE" }, { status: 400 });
    }
    logSafeOrderError("admin.order.item_status_change.failed", {
      requestId,
      reason: "SERVER_ERROR",
      elapsedMs: Date.now() - startedAt,
    }, error);
    return NextResponse.json({ error: "ITEM_STATUS_UPDATE_FAILED" }, { status: 500 });
  }
}
