import { NextRequest, NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security";

export const runtime = "nodejs";

function jsonWithSecurity(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function calculateTotal(rawItems: unknown) {
  if (!Array.isArray(rawItems)) return 0;

  return rawItems.reduce((sum, rawItem) => {
    if (!rawItem || typeof rawItem !== "object") return sum;
    const item = rawItem as Record<string, unknown>;
    const price = toFiniteNumber(item.price);
    const quantity = toFiniteNumber(item.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return sum;
    return sum + price * quantity;
  }, 0);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    console.log("[ORDER_VALIDATE_CART_JSON_PARSE_ERROR]", error);
    body = {};
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const totalAmount = calculateTotal(items);

  return jsonWithSecurity({
    code: "OK",
    totalAmount,
    updatedCart: items,
  });
}
