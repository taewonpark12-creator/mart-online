import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateOrderNumber,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";

export const runtime = "nodejs";

const VALID_FULFILLMENT: FulfillmentType[] = ["DELIVERY", "PICKUP"];
const VALID_PAYMENT: PaymentMethod[] = ["ONSITE_CARD", "ONSITE_CASH", "BANK_TRANSFER"];

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
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

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
  }

  const items = [];

  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== "object") {
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const item = rawItem as Record<string, unknown>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const price = Number(toNumber(item.price));
    const quantity = Number(toNumber(item.quantity));

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
    0,
  );

  const fulfillmentType =
    typeof body.fulfillmentType === "string" && VALID_FULFILLMENT.includes(body.fulfillmentType as FulfillmentType)
      ? (body.fulfillmentType as FulfillmentType)
      : "DELIVERY";
  const isPickup = fulfillmentType === "PICKUP";
  const paymentMethod =
    typeof body.paymentMethod === "string" && VALID_PAYMENT.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : null;

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: String(body.customerName ?? ""),
        customerPhone: String(body.customerPhone ?? ""),
        fulfillmentType,
        deliveryAddress: isPickup ? "매장 픽업" : String(body.deliveryAddress ?? ""),
        deliveryEntrance: isPickup ? null : String(body.deliveryEntrance ?? "") || null,
        pickupTime: isPickup ? String(body.pickupTime ?? "") || null : null,
        memo: String(body.memo ?? "") || null,
        paymentMethod: isPickup ? null : paymentMethod,
        totalAmount,
        items: { create: items },
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
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
