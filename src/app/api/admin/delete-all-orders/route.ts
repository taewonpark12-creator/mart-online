import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    // First, count the orders to be deleted
    const orderCount = await prisma.order.count();
    console.log(`[DELETE ALL ORDERS] Found ${orderCount} orders to delete`);

    if (orderCount === 0) {
      return NextResponse.json({
        message: "삭제할 주문이 없습니다.",
        deletedCount: 0,
      });
    }

    // Delete all orders (OrderItems will be cascade deleted automatically)
    const result = await prisma.order.deleteMany({});
    console.log(`[DELETE ALL ORDERS] Deleted ${result.count} orders`);

    // Verify deletion
    const remainingOrders = await prisma.order.count();
    const remainingOrderItems = await prisma.orderItem.count();

    console.log(`[DELETE ALL ORDERS] Remaining orders: ${remainingOrders}`);
    console.log(`[DELETE ALL ORDERS] Remaining order items: ${remainingOrderItems}`);

    return NextResponse.json({
      message: "모든 주문이 삭제되었습니다.",
      deletedCount: result.count,
      remainingOrders,
      remainingOrderItems,
    });
  } catch (error) {
    console.error("[DELETE ALL ORDERS] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "주문 삭제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
