import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getKoreaDateRangeUtc } from "@/lib/korea-date";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "daily";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { startUtc, endUtc } = getKoreaDateRangeUtc(startDate, endDate);

    const orderDateFilter = startUtc && endUtc
      ? { createdAt: { gte: startUtc, lte: endUtc } }
      : {};

    const activeItemStatus = "ACTIVE";

    const [pendingOrders, todayOrders, totalProducts, lowStock, approvedOrders, deliveredOrders, cancelledOrders] =
      await Promise.all([
        prisma.order.count({
          where: { status: "PENDING", ...orderDateFilter },
        }),

        prisma.order.count({
          where: {
            status: { not: "CANCELLED" },
            ...orderDateFilter,
          },
        }),

        prisma.product.count({
          where: { isActive: true },
        }),

        prisma.product.count({
          where: {
            isActive: true,
            stock: { lte: 10 },
          },
        }),

        prisma.order.count({
          where: { status: "APPROVED", ...orderDateFilter },
        }),

        prisma.order.count({
          where: { status: "DELIVERED", ...orderDateFilter },
        }),

        prisma.order.count({
          where: { status: "CANCELLED", ...orderDateFilter },
        }),

      ]);

    const activeSalesItems = await prisma.orderItem.findMany({
      where: {
        itemStatus: activeItemStatus,
        order: {
          status: { not: "CANCELLED" },
          ...orderDateFilter,
        },
      },
      select: {
        unitPrice: true,
        quantity: true,
      },
    });

    const todaySales = activeSalesItems.reduce(
      (sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
      0,
    );

    const salesData: Array<{
      date: string;
      sales: number;
      orderCount: number;
    }> = [];

    const days = period === "daily" ? 7 : 30;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate,
          },
          status: "DELIVERED",
          ...(startUtc && endUtc ? { createdAt: { gte: startUtc, lte: endUtc } } : {}),
        },
        include: {
          items: {
            where: { itemStatus: activeItemStatus },
            select: {
              unitPrice: true,
              quantity: true,
            },
          },
        },
      });

      const totalSales = orders.reduce(
        (sum, order) =>
          sum + order.items.reduce(
            (itemSum, item) => itemSum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
            0,
          ),
        0,
      );

      salesData.push({
        date: date.toISOString().split("T")[0],
        sales: totalSales,
        orderCount: orders.length,
      });
    }

    let popularProductDetails: Array<{
      id: string;
      name: string;
      quantity: number;
    }> = [];

    try {
      const popularProducts = await prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
        where: {
          itemStatus: activeItemStatus,
          order: {
            status: {
              not: "CANCELLED",
            },
          },
        },
      });

      popularProductDetails = await Promise.all(
        popularProducts.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: {
              id: item.productId ?? "",
            },
          });

          return {
            id: item.productId ?? "",
            name: product?.name ?? "상품명 없음",
            quantity: item._sum.quantity ?? 0,
          };
        })
      );
    } catch (popularError) {
      console.error(
        "popularProducts error:",
        popularError
      );
    }

    return NextResponse.json({
      pendingOrders,
      todayOrders,
      totalProducts,
      lowStock,
      approvedOrders,
      deliveredOrders,
      cancelledOrders,
      todaySales,
      salesData,
      popularProducts: popularProductDetails,
    });
  } catch (error) {
    console.error("STATS API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "통계 조회 실패",
      },
      { status: 500 }
    );
  }
}
