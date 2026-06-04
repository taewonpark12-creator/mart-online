import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone?.trim()) {
      return NextResponse.json({ error: "전화번호를 입력해주세요." }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      return NextResponse.json({ error: "올바른 전화번호를 입력해주세요." }, { status: 400 });
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: twentyFourHoursAgo } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });

    const matched = orders.filter((o) => normalizePhone(o.customerPhone) === normalized);

    return NextResponse.json(matched);
  } catch (error) {
    console.error("[GET /api/orders/check]", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
