export type Product = {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  price: number;
  category: string;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  isRecommended: boolean;
  isOnlineExclusive: boolean;
  isPopular: boolean;
  isOutOfStock: boolean;
  recommendedOrder?: number;
  popularOrder?: number;
  maxOrderQuantity?: number | null;
};

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  barcode?: string | null;
  imageUrl: string | null;
  quantity: number;
  normalPrice?: number | null;
  eventPrice?: number | null;
  discountRate?: number | null;
  isOutOfStock?: boolean;
  maxOrderQuantity?: number | null;
};

export const MIN_ORDER_AMOUNT = 40_000;

export type FulfillmentType = "DELIVERY" | "PICKUP";

export const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string; hint: string }[] = [
  { value: "DELIVERY", label: "諛곗넚", hint: "?낅젰?섏떊 二쇱냼濡?諛곕떖?⑸땲??" },
  { value: "PICKUP", label: "?쎌뾽", hint: "留ㅼ옣?먯꽌 吏곸젒 ?섎졊?⑸땲??" },
];

export const PICKUP_TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];

  for (let h = 9; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 9 && m === 0) continue;

      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;

      const ampm = h >= 12 ? "?ㅽ썑" : "?ㅼ쟾";
      const displayHour = h > 12 ? h - 12 : h;
      const displayHourStr = String(displayHour).padStart(2, "0");
      const label = `${ampm} ${displayHourStr}:${mm}`;

      slots.push({ value, label });
      if (h === 22 && m === 30) break;
    }
  }

  return slots;
})();

export const FULFILLMENT_TYPE_LABEL: Record<FulfillmentType, string> = {
  DELIVERY: "諛곗넚",
  PICKUP: "?쎌뾽",
};

export type PaymentMethod = "ONSITE_CARD" | "ONSITE_CASH" | "BANK_TRANSFER";
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "ONSITE_CARD", label: "현장결제(카드)" },
  { value: "ONSITE_CASH", label: "현장결제(현금)" },
  { value: "BANK_TRANSFER", label: "계좌이체" },
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  ONSITE_CARD: "현장결제(카드)",
  ONSITE_CASH: "현장결제(현금)",
  BANK_TRANSFER: "계좌이체",
};

export const BANK_ACCOUNT = {
  bank: "국민은행",
  number: "654937-01-011941",
  holder: "주식회사더마켓",
  display: "국민은행 654937-01-011941 주식회사더마켓",
};

export type OrderStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "주문접수" },
  { value: "CONFIRMED", label: "주문승인" },
  { value: "COMPLETED", label: "주문완료" },
  { value: "CANCELLED", label: "주문취소" },
];

export const ORDER_STATUS_FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

export const ORDER_STATUS_FILTER: OrderStatus[] = ORDER_STATUS_OPTIONS.map((option) => option.value);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "주문접수",
  CONFIRMED: "주문승인",
  COMPLETED: "주문완료",
  CANCELLED: "주문취소",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

export const CATEGORIES = [
  "전체",
  "과일/채소",
  "수산/건어물",
  "계육",
  "쌀/잡곡/견과",
  "냉장",
  "두부/콩나물",
  "대용량",
  "단무지",
  "냉장면",
  "냉장반찬",
  "생수/음료",
  "냉동식품",
  "간식",
  "빵",
  "라면",
  "건면/쫄면",
  "즉석식품",
  "통조림",
  "소스/양념",
  "조미료/향신료",
  "식용유/참기름",
  "빵가루/가루",
  "커피/차",
  "주방/위생/청소용품",
  "문안",
  "문화",
  "화장지",
  "기타",
  "반려동물",
] as const;

export const PRODUCT_CATEGORIES = CATEGORIES.filter((c) => c !== "전체");

export function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function formatPaymentMethodLabel(
  paymentMethod: PaymentMethod | null | undefined,
  fulfillmentType?: FulfillmentType,
) {
  if (fulfillmentType === "PICKUP" || paymentMethod == null) {
    return "매장에서 결제";
  }
  return PAYMENT_METHOD_LABEL[paymentMethod];
}

export function formatPickupTimeLabel(pickupTime: string) {
  return pickupTime;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function generateOrderNumber() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
      : Math.random().toString(36).slice(2, 14).toUpperCase().padEnd(12, "0");
  return `ORD-${timestamp}-${randomPart}`;
}
