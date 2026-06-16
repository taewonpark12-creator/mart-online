import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_ERROR = "Invalid order status transition.";

export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  if (from === "PAID") return false;
  if (from === "FAILED") return false;
  if (from === "CANCELLED") return false;
  if (from === "PENDING") return to === "PAID" || to === "FAILED" || to === "CANCELLED";
  return false;
}

export function getTransitionError(from: OrderStatus, to: OrderStatus) {
  if (to === "CANCELLED" && from !== "PENDING") {
    return "이미 처리된 주문은 취소할 수 없습니다.";
  }
  if (from === "PAID") {
    return "결제 완료 주문은 상태를 변경할 수 없습니다.";
  }
  if (from === "FAILED") {
    return "결제 실패 주문은 상태를 변경할 수 없습니다.";
  }
  if (from === "CANCELLED") {
    return "취소된 주문은 상태를 변경할 수 없습니다.";
  }
  return ORDER_STATUS_ERROR;
}
