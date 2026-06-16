"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import {
  FULFILLMENT_OPTIONS,
  MIN_ORDER_AMOUNT,
  type CartItem,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";
import { parseJsonResponse } from "@/lib/fetch-json";

const SHIPPING_PROFILES_KEY = "shippingProfiles";

type ShippingProfile = {
  id: string;
  name: string;
  phone: string;
  address: string;
  entrance?: string;
  updatedAt: string;
};

type CompletedOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress?: string;
  deliveryEntrance?: string;
  pickupTime?: string;
  paymentMethod?: PaymentMethod;
  items: CartItem[];
  totalAmount: number;
};

function createClientOrderId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortProfiles(value: unknown): ShippingProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (profile): profile is ShippingProfile =>
        Boolean(profile && typeof profile === "object" && "id" in profile),
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();

  const submitLockRef = useRef(false);

  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("DELIVERY");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryEntrance, setDeliveryEntrance] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const [memo, setMemo] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("ONSITE_CARD");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrder | null>(null);

  const [clientOrderId, setClientOrderId] = useState(createClientOrderId);

  const isDelivery = fulfillmentType === "DELIVERY";

  /**
   * ✅ 핵심: 주문 가능 조건 (UI 잠금)
   */
  const canSubmit =
    !loading &&
    items.length > 0 &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    (isDelivery ? address.trim().length > 0 : pickupTime.trim().length > 0);

  useEffect(() => {
    if (completedOrder) return;
    if (!items || items.length === 0) {
      router.replace("/cart");
    }
  }, [items, completedOrder, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;

    setError("");
    setLoading(true);

    try {
      const payload = {
        clientOrderId,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        fulfillmentType,

        deliveryAddress: isDelivery ? address.trim() : undefined,
        deliveryEntrance: isDelivery
          ? deliveryEntrance.trim() || undefined
          : undefined,

        pickupTime: !isDelivery ? pickupTime : undefined,

        memo: memo.trim() || undefined,
        paymentMethod: isDelivery ? paymentMethod : undefined,

        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse<{
        orderNumber?: string;
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "주문 실패");
      }

      if (!data.orderNumber) {
        throw new Error("주문번호 없음");
      }

      setCompletedOrder({
        orderNumber: data.orderNumber,
        customerName: name,
        customerPhone: phone,
        fulfillmentType,
        deliveryAddress: isDelivery ? address : undefined,
        deliveryEntrance: isDelivery
          ? deliveryEntrance.trim() || undefined
          : undefined,
        pickupTime: !isDelivery ? pickupTime : undefined,
        paymentMethod: isDelivery ? paymentMethod : undefined,
        items: [...items],
        totalAmount,
      });

      clearCart();
      setClientOrderId(createClientOrderId());
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 실패");
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  if (completedOrder) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />

        <div className="max-w-md mx-auto px-3 py-6">
          <div className="bg-white border rounded-2xl p-5">
            <h1 className="text-xl font-bold text-green-800 mb-4">
              주문 완료
            </h1>

            <p className="text-sm text-gray-500 mb-4">
              주문번호: {completedOrder.orderNumber}
            </p>

            <button
              onClick={() => router.replace("/")}
              className="w-full bg-green-600 text-white py-3 rounded-xl"
            >
              계속 쇼핑하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />

      <div className="max-w-md mx-auto px-3 py-6">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 border rounded-2xl">

          {/* 수령 방식 */}
          <fieldset>
            <legend className="font-semibold mb-2">수령 방식</legend>

            <div className="grid grid-cols-2 gap-2">
              {FULFILLMENT_OPTIONS.map((option) => (
                <label key={option.value} className="border rounded-xl p-3">
                  <input
                    type="radio"
                    value={option.value}
                    checked={fulfillmentType === option.value}
                    onChange={() => setFulfillmentType(option.value)}
                  />
                  <div className="text-sm font-semibold">
                    {option.label}
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 이름 */}
          <input
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
          />

          {/* 전화 */}
          <input
            placeholder="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border p-2 rounded"
          />

          {/* 배송 */}
          {isDelivery && (
            <input
              placeholder="주소"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border p-2 rounded"
            />
          )}

          {/* 픽업 */}
          {!isDelivery && (
            <input
              placeholder="픽업 시간"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full border p-2 rounded"
            />
          )}

          {/* 버튼 */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-green-600 text-white py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "처리 중..." : "주문 확정"}
          </button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </div>
    </div>
  );
}