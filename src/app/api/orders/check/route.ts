import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/types";

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
    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const orderNumber = String(searchParams.get("orderNumber") ?? query).trim();
    const phone = String(searchParams.get("phone") ?? query).trim();
    const normalizedPhone = normalizePhone(phone);

    if (!orderNumber && !normalizedPhone) {
      return NextResponse.json({ error: "QUERY_REQUIRED" }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: {
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
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const filteredOrders = normalizedPhone
      ? orders.filter(
          (order) =>
            order.orderNumber === orderNumber ||
            normalizePhone(order.customerPhone) === normalizedPhone,
        )
      : orders;

    return NextResponse.json({ orders: filteredOrders.map(serializeOrder) });
  } catch (error) {
    console.error("[ORDER_CHECK_ERROR]", error);
    return NextResponse.json(
      {
        error: "ORDER_CHECK_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
