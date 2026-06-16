import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

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
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: order.deliveryAddress,
    pickupTime: order.pickupTime,
    status: order.status,
    totalAmount: Number(order.totalAmount ?? 0),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      price: Number(item.unitPrice ?? 0),
      quantity: Number(item.quantity ?? 0),
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const orders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const serializedOrders = orders.map(serializeOrder);
    console.log("ADMIN_ORDERS_COUNT", serializedOrders.length);
    console.log("ADMIN_ORDERS_FIRST", serializedOrders[0]);

    return NextResponse.json({ orders: serializedOrders });
  } catch (error) {
    console.error("[ADMIN_ORDERS_ERROR]", error);
    return NextResponse.json(
      {
        error: "ADMIN_ORDERS_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
