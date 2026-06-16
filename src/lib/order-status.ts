import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_ERROR = "Invalid order status transition.";

export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  if (from === "DELIVERED") return false;
  if (from === "CANCELLED") return false;
  if (from === "PENDING") return to === "APPROVED" || to === "CANCELLED";
  if (from === "APPROVED") return to === "DELIVERED";
  return false;
}

export function getTransitionError(from: OrderStatus, to: OrderStatus) {
  if (to === "CANCELLED" && from !== "PENDING") {
    return "Orders that have already been approved cannot be cancelled.";
  }
  if (from === "DELIVERED") {
    return "Delivered orders are locked and cannot be changed.";
  }
  if (from === "CANCELLED") {
    return "Cancelled orders are locked and cannot be changed.";
  }
  return ORDER_STATUS_ERROR;
}
