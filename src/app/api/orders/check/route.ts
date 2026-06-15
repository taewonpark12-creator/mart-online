import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/types";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS;
}

function maskPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 7) return "***";
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function maskAddress(address: string) {
  if (!address) return "";
  return address.length <= 8 ? `${address.slice(0, 2)}***` : `${address.slice(0, 8)} ***`;
}

export async function GET(request: Request) {
  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phone = String(searchParams.get("phone") ?? "").trim();
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length < 10) {
      return NextResponse.json({ error: "연락처를 입력해주세요." }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: {
        customerPhone: {
          contains: normalizedPhone.slice(-4),
        },
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    const matchedOrders = orders.filter((order) => normalizePhone(order.customerPhone) === normalizedPhone);
    console.log("[CUSTOMER_ORDERS_FETCH]", {
      source: "prisma.order",
      phoneLast4: normalizedPhone.slice(-4),
      candidateCount: orders.length,
      matchedCount: matchedOrders.length,
      latestMatchedOrder: matchedOrders[0]
        ? {
            id: matchedOrders[0].id,
            orderNumber: matchedOrders[0].orderNumber,
            status: matchedOrders[0].status,
            createdAt: matchedOrders[0].createdAt,
          }
        : null,
    });

    return NextResponse.json(
      matchedOrders
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: maskPhone(order.customerPhone),
          fulfillmentType: order.fulfillmentType,
          deliveryAddress: maskAddress(order.deliveryAddress),
          deliveryEntrance: order.deliveryEntrance ? "***" : null,
          pickupTime: order.pickupTime,
          memo: order.memo ? "***" : null,
          paymentMethod: order.paymentMethod,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        })),
    );
  } catch (error) {
    console.error("[GET /api/orders/check]", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
