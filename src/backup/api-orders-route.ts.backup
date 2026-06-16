import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/types";

export const runtime = "nodejs";

type FulfillmentType = "DELIVERY" | "PICKUP";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function serializeOrder(order: {
  orderNumber: string;
  status: string;
  totalAmount: number;
}) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: Number(order.totalAmount ?? 0),
  };
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

  try {
    const customerName = asString(body.customerName);
    const customerPhone = asString(body.customerPhone);
    const fulfillmentType = body.fulfillmentType as FulfillmentType;
    const deliveryAddress = asString(body.deliveryAddress);
    const pickupTime = asString(body.pickupTime);
    const memo = asString(body.memo);

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: "MISSING_CUSTOMER_INFO" }, { status: 400 });
    }

    if (fulfillmentType !== "DELIVERY" && fulfillmentType !== "PICKUP") {
      return NextResponse.json({ error: "INVALID_FULFILLMENT_TYPE" }, { status: 400 });
    }

    if (fulfillmentType === "DELIVERY" && !deliveryAddress) {
      return NextResponse.json({ error: "MISSING_DELIVERY_ADDRESS" }, { status: 400 });
    }

    if (fulfillmentType === "PICKUP" && !pickupTime) {
      return NextResponse.json({ error: "MISSING_PICKUP_TIME" }, { status: 400 });
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const items = body.items.map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const productId = asString(item.productId);
      const productName = asString(item.productName) || asString(item.name);
      const price = asNumber(item.price);
      const quantity = asNumber(item.quantity);

      if (
        !productId ||
        !productName ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return null;
      }

      return {
        productId,
        productName,
        price,
        quantity,
      };
    });

    if (items.some((item) => item === null)) {
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    const orderItems = items as Array<{
      productId: string;
      productName: string;
      price: number;
      quantity: number;
    }>;
    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    console.log("CREATE_ORDER_BODY", body);
    console.log("CREATE_ORDER_ITEMS", orderItems);

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerPhone,
        fulfillmentType,
        deliveryAddress:
          fulfillmentType === "DELIVERY" ? deliveryAddress : "매장 픽업",
        pickupTime: fulfillmentType === "PICKUP" ? pickupTime : null,
        memo: memo || null,
        paymentMethod: fulfillmentType === "DELIVERY" ? "ONSITE_CASH" : null,
        totalAmount,
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
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

    return NextResponse.json(serializeOrder(order));
  } catch (error) {
    console.error("ORDER_CREATE_ERROR", error);
    return NextResponse.json(
      {
        error: "ORDER_CREATE_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
