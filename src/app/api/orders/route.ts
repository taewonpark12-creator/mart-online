import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/types";

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

  // -----------------------------
  // 1. items 검증 (필수)
  // -----------------------------
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

  // -----------------------------
  // 2. fulfillmentType (핵심 수정)
  // -----------------------------
  if (
    body.fulfillmentType !== "DELIVERY" &&
    body.fulfillmentType !== "PICKUP"
  ) {
    return NextResponse.json(
      { error: "INVALID_FULFILLMENT_TYPE" },
      { status: 400 }
    );
  }

  const fulfillmentType = body.fulfillmentType as "DELIVERY" | "PICKUP";
  const isPickup = fulfillmentType === "PICKUP";

  // -----------------------------
  // 3. 필수 고객 정보 검증
  // -----------------------------
  const customerName =
    typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone =
    typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";

  if (!customerName || !customerPhone) {
    return NextResponse.json(
      { error: "MISSING_CUSTOMER_INFO" },
      { status: 400 }
    );
  }

  // -----------------------------
  // 4. 배송 / 픽업 분기 검증
  // -----------------------------

  if (!isPickup) {
    const address =
      typeof body.deliveryAddress === "string"
        ? body.deliveryAddress.trim()
        : "";

    if (!address) {
      return NextResponse.json(
        { error: "MISSING_DELIVERY_ADDRESS" },
        { status: 400 }
      );
    }
  }

  if (isPickup) {
    const pickupTime =
      typeof body.pickupTime === "string"
        ? body.pickupTime.trim()
        : "";

    if (!pickupTime) {
      return NextResponse.json(
        { error: "MISSING_PICKUP_TIME" },
        { status: 400 }
      );
    }
  }

  console.log("CREATE_ORDER_BODY", body);
  console.log("CREATE_ORDER_ITEMS", body.items);

  // -----------------------------
  // 5. DB 저장
  // -----------------------------
  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerPhone,
        fulfillmentType,

        deliveryAddress: isPickup
          ? "매장 픽업"
          : (body.deliveryAddress as string),

        deliveryEntrance: isPickup
          ? null
          : (String(body.deliveryEntrance ?? "") || null),

        pickupTime: isPickup
          ? (body.pickupTime as string)
          : null,

        memo:
          typeof body.memo === "string" ? body.memo : null,

        paymentMethod: null,

        totalAmount,

        items: {
          create: items,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
      },
    });

    console.log("ORDER_CREATED", order);

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error("ORDER_CREATE_ERROR", error);
    return NextResponse.json(
      { error: "ORDER_CREATE_FAILED", detail: String(error) },
      { status: 500 }
    );
  }
}
