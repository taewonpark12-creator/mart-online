import { randomUUID } from "crypto";

export type OrderErrorCode =
  | "PRICE_CHANGED"
  | "PRICE_SOURCE_UNAVAILABLE"
  | "INVALID_ORDER"
  | "INVALID_STATUS_TRANSITION"
  | "ORDER_NOT_FOUND"
  | "DUPLICATE_CLIENT_ORDER_ID"
  | "DUPLICATE_ORDER_NUMBER"
  | "UNIQUE_CONSTRAINT_VIOLATION"
  | "NOT_FOUND"
  | "FOREIGN_KEY_ERROR"
  | "PRISMA_VALIDATION_ERROR"
  | "PRISMA_INITIALIZATION_ERROR"
  | "PRISMA_CONNECTION_ERROR"
  | "DB_SCHEMA_MISMATCH"
  | "ORDER_METADATA_COLUMNS_MISSING"
  | "DB_UNKNOWN_ERROR"
  | "NULL_POINTER"
  | "UNKNOWN_RUNTIME_ERROR"
  | "SERVER_ERROR";

export function createRequestId() {
  return randomUUID();
}

export function logOrderFailure(details: {
  requestId: string;
  errorCode: OrderErrorCode | string;
  stage?: string;
  elapsedMs?: number;
  priceSourceVersion?: string | null;
  productId?: string | null;
  endpoint: string;
  message?: string;
  clientOrderId?: string | null;
  orderNumber?: string | null;
  payloadSummary?: unknown;
  error?: unknown;
}) {
  console.error("[order-failure]", JSON.stringify(details));
}

export function logOrderEvent(details: {
  requestId: string;
  stage: string;
  elapsedMs: number;
  endpoint?: string;
  clientOrderId?: string | null;
  orderNumber?: string | null;
  priceSourceVersion?: string | null;
  productId?: string | null;
  userAgent?: string | null;
  message?: string;
  extra?: unknown;
}) {
  console.info("[order-event]", JSON.stringify({
    endpoint: "/api/orders",
    ...details,
  }));
}

export function orderErrorBody(details: {
  requestId: string;
  code: OrderErrorCode | string;
  error: string;
  stage?: string;
  priceSourceVersion?: string | null;
  productId?: string | null;
  updatedCart?: unknown;
}) {
  return {
    success: false,
    requestId: details.requestId,
    errorCode: details.code,
    code: details.code,
    stage: details.stage,
    message: details.error,
    error: details.error,
    ...(details.priceSourceVersion && { priceSourceVersion: details.priceSourceVersion }),
    ...(details.productId && { productId: details.productId }),
    ...(details.updatedCart !== undefined ? { updatedCart: details.updatedCart } : {}),
  };
}
