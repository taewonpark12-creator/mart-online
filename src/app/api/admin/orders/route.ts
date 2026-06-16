import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const rawOrderCount = await prisma.order.count();
    const orders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

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

    const serializedOrders = orders.map((order) => ({
      ...order,
      totalAmount: order.totalAmount.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
      })),
    }));

    return NextResponse.json(serializedOrders);
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
