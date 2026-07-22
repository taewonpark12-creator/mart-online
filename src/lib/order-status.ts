import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_ERROR = "Invalid order status transition.";

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return true;
}

export function getTransitionError(from: OrderStatus, to: OrderStatus) {
  return null;
}
