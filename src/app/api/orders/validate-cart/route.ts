import { NextRequest, NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security";
import { PriceSourceUnavailableError } from "@/lib/order-pricing";
import {
  OrderValidationError,
  validateSubmittedCart,
} from "@/lib/order-cart-validation";
import {
  createRequestId,
  logOrderFailure,
  orderErrorBody,
} from "@/lib/order-observability";

export const runtime = "nodejs";

function jsonWithSecurity(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function fail(details: {
  requestId: string;
  code: string;
  error: string;
  status: number;
  priceSourceVersion?: string | null;
  productId?: string | null;
  updatedCart?: unknown;
}) {
  logOrderFailure({
    requestId: details.requestId,
    errorCode: details.code,
    priceSourceVersion: details.priceSourceVersion,
    productId: details.productId,
    endpoint: "/api/orders/validate-cart",
    message: details.error,
  });

  return jsonWithSecurity(
    orderErrorBody({
      requestId: details.requestId,
      code: details.code,
      error: details.error,
      priceSourceVersion: details.priceSourceVersion,
      productId: details.productId,
      updatedCart: details.updatedCart,
    }),
    { status: details.status },
  );
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  let priceSourceVersion: string | undefined;

  try {
    const body = await req.json();
    const validated = await validateSubmittedCart(body.items);
    priceSourceVersion = validated.priceSourceVersion;

    return jsonWithSecurity({
      requestId,
      code: "OK",
      totalAmount: validated.totalAmount,
      warning: validated.minimumOrderWarning,
      priceSourceVersion: validated.priceSourceVersion,
      updatedCart: validated.updatedCart,
    });
  } catch (error) {
    if (error instanceof PriceSourceUnavailableError) {
      return fail({
        requestId,
        code: "PRICE_SOURCE_UNAVAILABLE",
        error: "PRICE_SOURCE_UNAVAILABLE",
        status: 503,
        priceSourceVersion,
      });
    }

    if (error instanceof OrderValidationError) {
      return fail({
        requestId,
        code: error.code,
        error: error.message,
        status: error.status,
        priceSourceVersion: error.priceSourceVersion ?? priceSourceVersion,
        productId: error.productId,
        updatedCart: error.updatedCart,
      });
    }

    console.error("[POST /api/orders/validate-cart]", { requestId, error });
    return fail({
      requestId,
      code: "UNKNOWN_RUNTIME_ERROR",
      error: "장바구니 검증 중 오류가 발생했습니다.",
      status: 500,
      priceSourceVersion,
    });
  }
}
