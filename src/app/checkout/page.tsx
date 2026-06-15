"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import {
  BANK_ACCOUNT,
  FULFILLMENT_OPTIONS,
  MIN_ORDER_AMOUNT,
  PAYMENT_METHOD_OPTIONS,
  PICKUP_TIME_SLOTS,
  formatPrice,
  type CartItem,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";
import { parseJsonResponse } from "@/lib/fetch-json";
import { STORE } from "@/lib/store";

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
    .filter((profile): profile is ShippingProfile =>
      Boolean(profile && typeof profile === "object" && "id" in profile && "name" in profile),
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart, replaceItems } = useCart();
  const submitLockRef = useRef(false);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("DELIVERY");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryEntrance, setDeliveryEntrance] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONSITE_CARD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [clientOrderId, setClientOrderId] = useState(createClientOrderId);

  const isDelivery = fulfillmentType === "DELIVERY";
  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;

  /**
   * ✅ 핵심 수정: 안전한 redirect 가드
   */
  useEffect(() => {
    if (completedOrder) return;
    if (!items || items.length === 0) {
      router.replace("/cart");
    }
  }, [items, completedOrder, router]);

  useEffect(() => {
    const saved = localStorage.getItem(SHIPPING_PROFILES_KEY);
    if (!saved) return;

    try {
      const profiles = sortProfiles(JSON.parse(saved));
      setShippingProfiles(profiles);
      if (profiles[0]) applyShippingProfile(profiles[0], "최근 배송 정보를 불러왔습니다.");
    } catch (err) {
      console.error("Failed to load shipping profiles:", err);
    }
  }, []);

  function applyShippingProfile(profile: ShippingProfile, message = "저장된 배송 정보를 불러왔습니다.") {
    setSelectedProfileId(profile.id);
    setName(profile.name);
    setPhone(profile.phone);
    setAddress(profile.address);
    setDeliveryEntrance(profile.entrance || "");
    setProfileMessage(message);
  }

  function persistShippingProfiles(profiles: ShippingProfile[]) {
    const nextProfiles = sortProfiles(profiles);
    setShippingProfiles(nextProfiles);
    localStorage.setItem(SHIPPING_PROFILES_KEY, JSON.stringify(nextProfiles));
  }

  function handleSaveShippingProfile() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setProfileMessage("이름, 연락처, 주소를 모두 입력해주세요.");
      return;
    }

    const profile: ShippingProfile = {
      id: selectedProfileId || Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      entrance: deliveryEntrance.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    persistShippingProfiles([
      profile,
      ...shippingProfiles.filter((savedProfile) => savedProfile.id !== profile.id),
    ]);

    setSelectedProfileId(profile.id);
    setProfileMessage("배송 정보가 저장되었습니다.");
  }

  function handleDeleteShippingProfile(id: string) {
    persistShippingProfiles(shippingProfiles.filter((profile) => profile.id !== id));
    if (selectedProfileId === id) setSelectedProfileId("");
    setProfileMessage("저장된 배송 정보를 삭제했습니다.");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || submitLockRef.current) return;
    submitLockRef.current = true;

    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      submitLockRef.current = false;
      setError("장바구니 수량을 다시 확인해주세요.");
      return;
    }

    if (!isDelivery && !pickupTime) {
      submitLockRef.current = false;
      setError("픽업 예정 시간을 선택해주세요.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const cartPayload = {
        totalAmount,
        items: items.map((item) => ({
          productId: item.productId,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          normalPrice: item.normalPrice,
          eventPrice: item.eventPrice,
          discountRate: item.discountRate,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientOrderId,
          customerName: name,
          customerPhone: phone,
          fulfillmentType,
          deliveryAddress: isDelivery ? address : undefined,
          deliveryEntrance: isDelivery ? deliveryEntrance.trim() || undefined : undefined,
          pickupTime: isDelivery ? undefined : pickupTime,
          memo,
          paymentMethod: isDelivery ? paymentMethod : undefined,
          totalAmount,
          items: cartPayload.items,
        }),
      });

      const data = await parseJsonResponse<{
        orderNumber?: string;
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error ?? "주문에 실패했습니다.");
      }

      if (!data.orderNumber) {
        throw new Error("주문번호를 받지 못했습니다.");
      }

      setCompletedOrder({
        orderNumber: data.orderNumber,
        customerName: name,
        customerPhone: phone,
        fulfillmentType,
        deliveryAddress: isDelivery ? address : undefined,
        deliveryEntrance: isDelivery ? deliveryEntrance.trim() || undefined : undefined,
        pickupTime: isDelivery ? undefined : pickupTime,
        paymentMethod: isDelivery ? paymentMethod : undefined,
        items: items.map((item) => ({ ...item })),
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
              type="button"
              onClick={() => router.replace("/")}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
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
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-2xl border">

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
                  <div className="text-sm font-semibold">{option.label}</div>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl"
          >
            {loading ? "처리 중..." : "주문 확정"}
          </button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </div>
    </div>
  );
}