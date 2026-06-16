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
    isOnlineExclusive: boolean; // <--- 이 줄을 추가했습니다
    isPopular: boolean; // 인기상품
    isOutOfStock: boolean;
    recommendedOrder?: number;
    popularOrder?: number; // 인기상품 정렬 순서
    maxOrderQuantity?: number | null; // 최대 주문 수량 (null 또는 0이면 제한 없음)
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
    maxOrderQuantity?: number | null; // 최대 주문 수량 (null 또는 0이면 제한 없음)
  };

  export const MIN_ORDER_AMOUNT = 40_000;

  export type FulfillmentType = "DELIVERY" | "PICKUP";

  export const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string; hint: string }[] = [
    { value: "DELIVERY", label: "배송", hint: "입력하신 주소로 배달합니다" },
    { value: "PICKUP", label: "픽업", hint: "매장에서 직접 수령합니다" },
  ];

  /** 💡 픽업 예정 시각 수정 (라벨에서 '경' 제외 -> "오전 09:30" 형태로 출력) */
  export const PICKUP_TIME_SLOTS = (() => {
    const slots: { value: string; label: string }[] = [];
    
    for (let h = 9; h <= 22; h++) {
      for (const m of [0, 30]) {
        if (h === 9 && m === 0) continue;
        
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        const value = `${hh}:${mm}`;

        let ampm = "오전";
        let displayHour = h;
        
        if (h >= 12) {
          ampm = "오후";
          if (h > 12) {
            displayHour = h - 12;
          }
        }
        
        const displayHourStr = String(displayHour).padStart(2, "0");
        // 💡 기존 `${ampm} ${displayHourStr}:${mm}경` 에서 '경'을 뺐습니다.
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
  export type OutOfStockPolicy = "SUBSTITUTE" | "CANCEL_ONLY" | "CONTACT";

  export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
    { value: "ONSITE_CARD", label: "현장결제(카드)" },
    { value: "ONSITE_CASH", label: "현장결제(현금)" },
    { value: "BANK_TRANSFER", label: "계좌이체" },
  ];

  export const OUT_OF_STOCK_POLICY_OPTIONS: { value: OutOfStockPolicy; label: string }[] = [
    { value: "SUBSTITUTE", label: "대체상품 받기" },
    { value: "CANCEL_ONLY", label: "품절된 상품만 취소" },
    { value: "CONTACT", label: "연락바람" },
  ];

  export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    ONSITE_CARD: "현장결제(카드)",
    ONSITE_CASH: "현장결제(현금)",
    BANK_TRANSFER: "계좌이체",
  };

  export const BANK_ACCOUNT = {
    bank: "국민은행",
    number: "654937-01-011941",
    holder: "한사랑마트",
    display: "국민은행 654937-01-011941 한사랑마트",
  };

  export const OUT_OF_STOCK_POLICY_LABEL: Record<OutOfStockPolicy, string> = {
    SUBSTITUTE: "대체상품 받기",
    CANCEL_ONLY: "품절된 상품만 취소",
    CONTACT: "연락바람",
  };

  export type OrderStatus = "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";

  /** 진행 단계 (취소는 별도 버튼) */
  export const ORDER_STATUS_FLOW: OrderStatus[] = ["PENDING", "APPROVED", "DELIVERED"];

  /** 관리자 필터용 */
  export const ORDER_STATUS_FILTER: OrderStatus[] = [
    ...ORDER_STATUS_FLOW,
    "CANCELLED",
  ];

  export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    PENDING: "신규주문",
    APPROVED: "확인완료",
    DELIVERED: "배송완료",
    CANCELLED: "취소됨",
  };

  export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-blue-100 text-blue-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  export const CATEGORIES = ["전체", "과일/채소", "계란", "수산/건어물", "쌀/잡곡/견과", "햄/어묵", "유제품", "두부/콩나물", "냉장밀키트", "생수/음료", "단무지", "떡/냉장면", "냉동식품", "간식", "빵", "라면", '건면/당면', "즉석식품", "통조림", "장류/소스/양념", "조미료/향신료", "식용유/참기름", "밀가루/가루", "커피/차", "주방/세탁/청소용품", "세안", "화장지", "방충", "기저귀/생리대", "잡화", "반려동물", "미분류" ] as const;

  /** 상품 등록·수정용 (전체 제외) */
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

  // 💡 영수증이나 관리자 화면 등 다른 곳에서 시간 라벨을 쓸 때도 '경'이 안 붙도록 그대로 반환합니다.
  export function formatPickupTimeLabel(pickupTime: string) {
    return pickupTime;
  }

  export function normalizePhone(phone: string) {
    return phone.replace(/\D/g, "");
  }

  export function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `ORD-${date}-${rand}`;
  }
