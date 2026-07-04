export const EVENT_MIN_ORDER_START = "2026-07-04";
export const EVENT_MIN_ORDER_END = "2026-07-15";
export const EVENT_MIN_ORDER_AMOUNT = 30_000;
export const DEFAULT_MIN_ORDER_AMOUNT = 40_000;

function getKstDateKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isMinOrderEventActive(now = new Date()) {
  const today = getKstDateKey(now);
  return today >= EVENT_MIN_ORDER_START && today <= EVENT_MIN_ORDER_END;
}

export function getMinimumOrderAmount(now = new Date()) {
  return isMinOrderEventActive(now) ? EVENT_MIN_ORDER_AMOUNT : DEFAULT_MIN_ORDER_AMOUNT;
}
