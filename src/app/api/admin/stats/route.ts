import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingOrders, todayOrders, totalProducts, lowStock] =
      await Promise.all([
        prisma.order.count({
          where: { status: "PENDING" },
        }),

        prisma.order.count({
          where: {
            createdAt: { gte: today },
            status: { not: "CANCELLED" },
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
      ]);

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
          status: {
            in: ["APPROVED", "DELIVERED"],
          },
        },
      });

      const totalSales = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount ?? 0),
        0
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
            name: product?.name ?? "알 수 없음",
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