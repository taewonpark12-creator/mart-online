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
  { value: "DELIVERY", label: "배송", hint: "입력하신 주소로 배달합니다." },
  { value: "PICKUP", label: "픽업", hint: "매장에서 직접 수령합니다." },
];

export const PICKUP_TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];

  for (let h = 9; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 9 && m === 0) continue;

      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;

      const ampm = h >= 12 ? "오후" : "오전";
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
  DELIVERY: "배송",
  PICKUP: "픽업",
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
  holder: "주식회사알마트",
  display: "국민은행 654937-01-011941 주식회사알마트",
};

export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED";

export const ORDER_STATUS_FLOW: OrderStatus[] = ["PENDING", "PAID"];

export const ORDER_STATUS_FILTER: OrderStatus[] = [
  ...ORDER_STATUS_FLOW,
  "FAILED",
  "CANCELED",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "접수대기",
  PAID: "결제완료",
  FAILED: "결제실패",
  CANCELED: "주문취소",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-700",
};

export const CATEGORIES = [
  "전체",
  "간식",
  "건면/당면",
  "계란",
  "과일/채소",
  "기저귀/생리대",
  "냉동식품",
  "냉장밀키트",
  "단무지",
  "두부/콩나물",
  "떡/냉장면",
  "빵",
  "라면",
  "밀가루/가루",
  "반려동물",
  "방충",
  "생수/음료",
  "세안",
  "수산/건어물",
  "식용유/참기름",
  "쌀/잡곡/견과",
  "유제품",
  "잡화",
  "장류/소스/양념",
  "조미료/향신료",
  "주방/세탁/청소용품",
  "즉석식품",
  "커피/차",
  "통조림",
  "햄/어묵",
  "화장지",
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
