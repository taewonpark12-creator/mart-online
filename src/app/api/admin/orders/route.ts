import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

const allowedStatuses = [
  "PENDING",
  "APPROVED",
  "DELIVERED",
  "CANCELLED",
];

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
  items?: Array<{
    id: string;
    productId: string | null;
    productName?: string;
    name?: string;
    unitPrice?: number;
    price?: number;
    quantity?: number;
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
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.name || "상품명 없음",
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (status && !allowedStatuses.includes(status)) {
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
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }

    const orders = await prisma.order.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const serializedOrders = orders.map(serializeOrder);
    console.log("ADMIN_ORDERS_COUNT", serializedOrders.length);
    console.log("ADMIN_ORDERS_FIRST", serializedOrders[0]);

    return NextResponse.json(serializedOrders);
  } catch (error) {
    console.error("[ADMIN_ORDERS_ERROR]", error);
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
