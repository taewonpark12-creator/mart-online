export const ORDER_CUTOFF_HOUR = 20;
export const ORDER_CUTOFF_MINUTE = 0;

export const CHECKOUT_CUTOFF_NOTICE =
  "📢 오후 8시 이후 접수된 주문은 다음 날 오전 10시 이후부터 순차적으로 배송됩니다.";

export const ORDER_COMPLETE_CUTOFF_NOTICE =
  "📢 오후 8시 이후 접수된 주문으로 확인되어 내일 오전 10시 이후부터 순차적으로 배송될 예정입니다.";

const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKoreaTimeParts(date = new Date()) {
  const koreaTime = new Date(date.getTime() + KOREA_TIME_OFFSET_MS);

  return {
    hour: koreaTime.getUTCHours(),
    minute: koreaTime.getUTCMinutes(),
  };
}

export function isAfterCutoffTime(date = new Date()) {
  const { hour, minute } = getKoreaTimeParts(date);

  return (
    hour > ORDER_CUTOFF_HOUR ||
    (hour === ORDER_CUTOFF_HOUR && minute >= ORDER_CUTOFF_MINUTE)
  );
}
