export const EVENT_MIN_ORDER_START = "2026-07-01";
export const EVENT_MIN_ORDER_END = "2026-07-31";
export const EVENT_MIN_ORDER_AMOUNT = 30_000;
export const DEFAULT_MIN_ORDER_AMOUNT = 40_000;

function getServerDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isMinOrderEventActive(now = new Date()) {
  const today = getServerDateKey(now);
  return today >= EVENT_MIN_ORDER_START && today <= EVENT_MIN_ORDER_END;
}

export function getMinimumOrderAmount(now = new Date()) {
  return isMinOrderEventActive(now) ? EVENT_MIN_ORDER_AMOUNT : DEFAULT_MIN_ORDER_AMOUNT;
}
