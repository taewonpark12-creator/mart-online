import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    // 1. phone parameter null 체크 강화
    if (!phone) {
      console.error("[GET /api/orders/check] phone parameter is null");
      return NextResponse.json({ error: "전화번호를 입력해주세요." }, { status: 400 });
    }

    // 4. phone 포맷 통일 처리 (trim 후 정규화)
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      console.error("[GET /api/orders/check] phone parameter is empty after trim");
      return NextResponse.json({ error: "전화번호를 입력해주세요." }, { status: 400 });
    }

    const normalized = normalizePhone(trimmedPhone);
    if (normalized.length < 10) {
      console.error("[GET /api/orders/check] phone number too short:", normalized);
      return NextResponse.json({ error: "올바른 전화번호를 입력해주세요." }, { status: 400 });
    }

    console.log("[GET /api/orders/check] Searching for phone:", normalized);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 2. Prisma 조회 오류 처리 강화
    let orders;
    try {
      orders = await prisma.order.findMany({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      });
    } catch (prismaError) {
      console.error("[GET /api/orders/check] Prisma query error:", prismaError);
      return NextResponse.json({ error: "데이터베이스 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    // 3. orders가 undefined/null일 경우 안전하게 빈 배열 반환
    if (!orders) {
      console.warn("[GET /api/orders/check] orders is null/undefined, returning empty array");
      return NextResponse.json([]);
    }

    console.log("[GET /api/orders/check] Found orders:", orders.length);

    // 3. matched 값 안전 처리
    const matched = orders.filter((o) => {
      if (!o.customerPhone) {
        console.warn("[GET /api/orders/check] Order has null customerPhone:", o.id);
        return false;
      }
      const normalizedCustomerPhone = normalizePhone(o.customerPhone);
      const isMatch = normalizedCustomerPhone === normalized;
      if (isMatch) {
        console.log("[GET /api/orders/check] Matched order:", o.id, o.orderNumber);
      }
      return isMatch;
    });

    // 3. matched가 undefined/null일 경우 안전하게 빈 배열 반환
    const result = matched || [];

    console.log("[GET /api/orders/check] Matched orders:", result.length);

    // BigInt를 문자열로 변환하여 직렬화 오류 방지
    const serialized = JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json(serialized);
  } catch (error) {
    // 6. 서버 로그로 실제 에러 원인 출력
    console.error("[GET /api/orders/check] Unexpected error:", error);
    console.error("[GET /api/orders/check] Error stack:", error instanceof Error ? error.stack : String(error));
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
