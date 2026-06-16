"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import {
  STORE,
} from "@/lib/store";
import { formatPrice } from "@/lib/types";
import { parseJsonResponse } from "@/lib/fetch-json";

type FulfillmentType = "DELIVERY" | "PICKUP";

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

function createClientOrderId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();

  const submitLockRef = useRef(false);

  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("DELIVERY");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [address, setAddress] = useState("");
  const [pickupTime, setPickupTime] = useState("09:30");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  const [clientOrderId, setClientOrderId] = useState(createClientOrderId());

  const isDelivery = fulfillmentType === "DELIVERY";

  /**
   * ✅ 주문 가능 여부
   */
  const canSubmit =
    !loading &&
    customerName.trim() &&
    customerPhone.trim() &&
    items.length > 0 &&
    (isDelivery ? address.trim() : pickupTime);

  useEffect(() => {
    if (!items || items.length === 0) {
      router.replace("/cart");
    }
  }, [items, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;

    setError("");
    setLoading(true);

    try {
      const payload = {
        clientOrderId,

        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),

        fulfillmentType: isDelivery ? "DELIVERY" : "PICKUP",

        deliveryAddress: isDelivery ? address.trim() : undefined,
        pickupTime: !isDelivery ? pickupTime : undefined,

        memo: note.trim() || undefined,

        paymentMethod: isDelivery ? "ONSITE_CASH" : undefined,

        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
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
        throw new Error(data?.error || "주문 실패");
      }

      if (!data.orderNumber) {
        throw new Error("주문번호 없음");
      }

      setCompletedOrder({
        orderNumber: data.orderNumber,
        customerName,
        customerPhone,
        fulfillmentType,
        deliveryAddress: isDelivery ? address : undefined,
        pickupTime: !isDelivery ? pickupTime : undefined,
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

        <div className="max-w-md mx-auto p-6">
          <div className="bg-white border rounded-xl p-6 text-center">
            <h1 className="text-xl font-bold mb-2">주문 완료</h1>

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

      <div className="max-w-md mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl border">

          {/* 수령 방식 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "픽업", value: "PICKUP" },
              { label: "배달", value: "DELIVERY" },
            ].map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setFulfillmentType(opt.value as FulfillmentType)}
                className={`p-3 border rounded-xl ${
                  fulfillmentType === opt.value ? "bg-green-100" : ""
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 이름 */}
          <input
            placeholder="이름"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full border p-2 rounded"
          />

          {/* 전화 */}
          <input
            placeholder="전화번호"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
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
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full border p-2 rounded"
            />
          )}

          {/* 요청사항 */}
          <textarea
            placeholder="요청사항"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border p-2 rounded"
          />

          {/* 주문 요약 */}
          <div className="text-sm border-t pt-3">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between">
                <span>{i.name} × {i.quantity}</span>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold mt-2">
              <span>총액</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
          </div>

          {/* 버튼 */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-green-600 text-white py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "처리 중..." : "주문하기"}
          </button>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
