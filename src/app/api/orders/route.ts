import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store";
import {
  MIN_ORDER_AMOUNT,
  PICKUP_TIME_SLOTS,
  generateOrderNumber,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";
import { createAuditLog } from "@/lib/audit";
import {
  validatePhoneNumber,
  validateName,
  validateAddress,
  validateAmount,
  sanitizeInput,
  getClientIp,
  getUserAgent,
  getSecurityHeaders,
} from "@/lib/security";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];
const PICKUP_TIME_VALUES = new Set(PICKUP_TIME_SLOTS.map((s) => s.value));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      fulfillmentType: rawFulfillment,
      deliveryAddress,
      deliveryEntrance,
      pickupTime,
      memo,
      paymentMethod,
      outOfStockPolicy,
      items,
    } = body;

    const fulfillmentType: FulfillmentType =
      rawFulfillment === "PICKUP" ? "PICKUP" : "DELIVERY";

    // 보안 검증
    if (!customerName?.trim() || !validateName(customerName)) {
      return NextResponse.json({ error: "유효하지 않은 이름입니다." }, { status: 400 });
    }

    if (!customerPhone?.trim() || !validatePhoneNumber(customerPhone)) {
      return NextResponse.json({ error: "유효하지 않은 연락처입니다." }, { status: 400 });
    }

    if (!VALID_FULFILLMENT.includes(fulfillmentType)) {
      return NextResponse.json({ error: "수령 방식이 올바르지 않습니다." }, { status: 400 });
    }

    if (fulfillmentType === "DELIVERY") {
      if (!deliveryAddress?.trim() || !validateAddress(deliveryAddress)) {
        return NextResponse.json({ error: "유효하지 않은 배달 주소입니다." }, { status: 400 });
      }
      if (!paymentMethod || !VALID_PAYMENT.includes(paymentMethod)) {
        return NextResponse.json({ error: "결제 방법을 선택해 주세요." }, { status: 400 });
      }
    } else {
      const time = pickupTime?.trim();
      if (!time || !PICKUP_TIME_VALUES.has(time)) {
        return NextResponse.json({ error: "픽업 예정 시각을 선택해 주세요." }, { status: 400 });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "주문 상품이 없습니다." }, { status: 400 });
    }

    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "유효하지 않은 상품이 포함되어 있습니다." }, { status: 400 });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalAmount = 0;
    const orderItems = items.map((i: { productId: string; quantity: number }) => {
      const product = productMap.get(i.productId)!;
      const quantity = Math.max(1, Number(i.quantity) || 1);
      
      // 최대 주문 수량 검증
      const maxOrderQuantity = product.maxOrderQuantity && product.maxOrderQuantity > 0 ? product.maxOrderQuantity : null;
      if (maxOrderQuantity && quantity > maxOrderQuantity) {
        throw new Error(`해당 상품은 1회 주문당 최대 ${maxOrderQuantity}개까지 구매 가능합니다.`);
      }
      
      const unitPrice = Number(product.price);
      totalAmount += unitPrice * quantity;
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
      };
    });

    if (totalAmount < MIN_ORDER_AMOUNT) {
      return NextResponse.json(
        { error: `최소 주문 금액은 ${MIN_ORDER_AMOUNT.toLocaleString("ko-KR")}원입니다.` },
        { status: 400 },
      );
    }

    const isPickup = fulfillmentType === "PICKUP";

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        fulfillmentType,
        deliveryAddress: isPickup
          ? `매장 픽업 · ${STORE.name}`
          : deliveryAddress.trim(),
        deliveryEntrance: isPickup ? null : deliveryEntrance?.trim() || null,
        pickupTime: isPickup ? pickupTime.trim() : null,
        memo: memo?.trim() || null,
        paymentMethod: isPickup ? null : paymentMethod,
        outOfStockPolicy: outOfStockPolicy ?? "CONTACT",
        totalAmount,
        items: { create: orderItems },
      },
    });

    // Audit Log 기록
    await createAuditLog({
      action: "CREATE",
      entity: "Order",
      entityId: order.id,
      changes: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        itemCount: items.length,
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    const response = NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
    // 보안 헤더 추가
    Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return NextResponse.json({ error: "주문 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
