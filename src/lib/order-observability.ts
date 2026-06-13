import { randomUUID } from "crypto";

export type OrderErrorCode =
  | "PRICE_CHANGED"
  | "PRICE_SOURCE_UNAVAILABLE"
  | "MIN_ORDER_AMOUNT_CHANGED"
  | "OUT_OF_STOCK"
  | "INVALID_ORDER"
  | "INVALID_STATUS_TRANSITION"
  | "ORDER_NOT_FOUND"
  | "SERVER_ERROR";

export function createRequestId() {
  return randomUUID();
}

export function logOrderFailure(details: {
  requestId: string;
  errorCode: OrderErrorCode | string;
  priceSourceVersion?: string | null;
  productId?: string | null;
  endpoint: string;
  message?: string;
}) {
  console.error("[order-failure]", JSON.stringify(details));
}

export function orderErrorBody(details: {
  requestId: string;
  code: OrderErrorCode | string;
  error: string;
  priceSourceVersion?: string | null;
  productId?: string | null;
  updatedCart?: unknown;
}) {
  return {
    requestId: details.requestId,
    code: details.code,
    error: details.error,
    ...(details.priceSourceVersion && { priceSourceVersion: details.priceSourceVersion }),
    ...(details.productId && { productId: details.productId }),
    ...(details.updatedCart !== undefined ? { updatedCart: details.updatedCart } : {}),
  };
}
