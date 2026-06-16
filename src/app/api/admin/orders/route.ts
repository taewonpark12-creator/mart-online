import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

function toNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const rawOrderCount = await prisma.order.count();
    const rawOrders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        fulfillmentType: true,
        deliveryAddress: true,
        deliveryEntrance: true,
        pickupTime: true,
        paymentMethod: true,
        memo: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            orderId: true,
            productId: true,
            productName: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    const orders = rawOrders.map((order) => ({
      ...order,
      customerName: order.customerName ?? "",
      customerPhone: order.customerPhone ?? "",
      fulfillmentType: order.fulfillmentType ?? "DELIVERY",
      deliveryAddress: order.deliveryAddress ?? "",
      totalAmount: toNumber(order.totalAmount),
      createdAt: toIsoString(order.createdAt),
      updatedAt: toIsoString(order.updatedAt),
      items: (order.items ?? []).map((item) => ({
        ...item,
        productName: item.productName ?? "",
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
      })),
    }));

    console.log("ADMIN_ORDERS_COUNT", orders.length);
    console.log("ADMIN_ORDERS_FIRST", orders[0]);
    console.log("[ADMIN_ORDERS_FETCH]", {
      source: "prisma.order",
      statusFilter: status,
      rawOrderCount,
      returnedCount: orders.length,
      latestOrder: orders[0]
        ? {
            id: orders[0].id,
            orderNumber: orders[0].orderNumber,
            status: orders[0].status,
            createdAt: orders[0].createdAt,
          }
        : null,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("[ADMIN_ORDERS_ERROR]", error);

    return NextResponse.json(
      {
        error: "ADMIN_ORDERS_FAILED",
        message: error instanceof Error ? error.message : String(error),
        stack:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 },
    );
  }
}
