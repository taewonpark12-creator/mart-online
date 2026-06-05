import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    // 관리자 인증 확인
    const authResult = await isAdminAuthenticated();
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // PENDING 상태인 주문 수만 조회
    const pendingCount = await prisma.order.count({
      where: {
        status: "PENDING",
      },
    });

    return NextResponse.json({ pendingCount });
  } catch (error) {
    console.error("[GET /api/admin/orders/pending-count] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
