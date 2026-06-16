import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS_ERROR = "허용되지 않은 주문상태 변경입니다.";

const ORDER_STATUS_FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  if (from === "CANCELLED" || from === "COMPLETED") return false;
  if (to === "CANCELLED") return from === "PENDING" || from === "CONFIRMED";

  const fromIndex = ORDER_STATUS_FLOW.indexOf(from);
  const toIndex = ORDER_STATUS_FLOW.indexOf(to);
  return fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex;
}

export function getTransitionError(from: OrderStatus, to: OrderStatus) {
  if (to === "CANCELLED" && from !== "PENDING" && from !== "CONFIRMED") {
    return "이미 처리된 주문은 취소할 수 없습니다.";
  }
  if (from === "COMPLETED") {
    return "완료된 주문은 상태를 변경할 수 없습니다.";
  }
  if (from === "CANCELLED") {
    return "취소된 주문은 상태를 변경할 수 없습니다.";
  }
  return ORDER_STATUS_ERROR;
}
