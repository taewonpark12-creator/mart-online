import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { OrderStatus } from "@/lib/types";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        status: true,
      },
    });

    const summary = {
      total: orders.length,
      pending: orders.filter((o) => o.status === "PENDING" as OrderStatus).length,
      approved: orders.filter((o) => o.status === "APPROVED" as OrderStatus).length,
      delivered: orders.filter((o) => o.status === "DELIVERED" as OrderStatus).length,
      cancelled: orders.filter((o) => o.status === "CANCELLED" as OrderStatus).length,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[GET /api/admin/orders/today-summary] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
