import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber, type FulfillmentType } from "@/lib/types";

export const runtime = "nodejs";

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // ----------------------------
  // 1. items validation (필수)
  // ----------------------------
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
  }

  const items = [];

  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const item = raw as Record<string, unknown>;

    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const price = toNumber(item.price);
    const quantity = toNumber(item.quantity);

    if (!productId || !Number.isFinite(price) || !Number.isFinite(quantity)) {
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    items.push({
      productId,
      productName: String(item.name ?? ""),
      quantity,
      unitPrice: price,
    });
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // ----------------------------
  // 2. fulfillmentType
  // ----------------------------
  const fulfillmentType =
    body.fulfillmentType === "PICKUP" ? "PICKUP" : "DELIVERY";

  const isPickup = fulfillmentType === "PICKUP";

  // ----------------------------
  // 3. 필수 정보 검증 (핵심 복구)
  // ----------------------------

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";

  if (!customerName || !customerPhone) {
    return NextResponse.json(
      { error: "MISSING_CUSTOMER_INFO" },
      { status: 400 }
    );
  }

  // 배송일 때
  if (!isPickup) {
    const address = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";

    if (!address) {
      return NextResponse.json(
        { error: "MISSING_DELIVERY_ADDRESS" },
        { status: 400 }
      );
    }
  }

  // 픽업일 때
  if (isPickup) {
    const pickupTime = typeof body.pickupTime === "string" ? body.pickupTime.trim() : "";

    if (!pickupTime) {
      return NextResponse.json(
        { error: "MISSING_PICKUP_TIME" },
        { status: 400 }
      );
    }
  }

  // ----------------------------
  // 4. DB 저장
  // ----------------------------
  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerPhone,
        fulfillmentType,

        deliveryAddress: isPickup ? "매장 픽업" : String(body.deliveryAddress),
        deliveryEntrance: isPickup ? null : (String(body.deliveryEntrance ?? "") || null),
        pickupTime: isPickup ? String(body.pickupTime) : null,

        memo: typeof body.memo === "string" ? body.memo : null,
        paymentMethod: null,

        totalAmount,
        items: {
          create: items,
        },
      },
      select: {
        orderNumber: true,
        status: true,
        totalAmount: true,
      },
    });

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
    });
  } catch (e) {
    console.error("[ORDER_DB_ERROR]", e);
    return NextResponse.json(
      { error: "DB_ERROR" },
      { status: 500 }
    );
  }
}