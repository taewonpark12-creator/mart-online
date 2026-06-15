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

  useEffect(() => {
    if (items.length === 0 && !completedOrder) {
      router.push("/cart");
    }
  }, [items.length, completedOrder, router]);

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

    if (!meetsMinimum) {
      submitLockRef.current = false;
      setError(`최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
      return;
    }
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

      const validationRes = await fetch("/api/orders/validate-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cartPayload),
      });
      const validationData = await parseJsonResponse<{
        code?: string;
        error?: string;
        updatedCart?: CartItem[];
      }>(validationRes);

      if (!validationRes.ok) {
        if (Array.isArray(validationData.updatedCart)) replaceItems(validationData.updatedCart);
        if (validationData.code === "PRICE_CHANGED") {
          throw new Error("상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.");
        }
        if (validationData.code === "PRICE_SOURCE_UNAVAILABLE") {
          throw new Error("가격 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        throw new Error(validationData.error ?? "장바구니를 다시 확인해주세요.");
      }

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
        code?: string;
        errorCode?: string;
        requestId?: string;
        updatedCart?: CartItem[];
      }>(res);

      if (!res.ok) {
        console.error("[checkout] /api/orders failed", {
          status: res.status,
          errorCode: data.errorCode ?? data.code,
          requestId: data.requestId ?? res.headers.get("x-request-id"),
          body: data,
        });
        if (Array.isArray(data.updatedCart)) replaceItems(data.updatedCart);
        if (data.code === "PRICE_CHANGED") {
          throw new Error("상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.");
        }
        if (data.code === "PRICE_SOURCE_UNAVAILABLE") {
          throw new Error("가격 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        throw new Error(data.error ?? "주문에 실패했습니다.");
      }
      if (!data.orderNumber) throw new Error("주문번호를 받지 못했습니다.");

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
      const message = err instanceof Error ? err.message : "주문을 접수하지 못했습니다. 잠시 후 다시 시도해주세요.";
      setError(message);
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  if (completedOrder) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />
        <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="bg-white border rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="text-center mb-6">
              <span className="text-4xl sm:text-5xl block mb-3">완료</span>
              <h1 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">주문이 접수되었습니다</h1>
              <p className="text-sm text-gray-500">
                주문번호 <span className="font-mono font-bold text-gray-900">{completedOrder.orderNumber}</span>
              </p>
            </div>

            <section className="mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2">주문 상품</h2>
              <div className="divide-y border rounded-xl overflow-hidden">
                {completedOrder.items.map((item) => (
                  <div key={item.productId} className="p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="shrink-0 text-gray-500">x {item.quantity}</p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatPrice(item.price)}</span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-right font-black text-green-700 mt-3">
                총 {formatPrice(completedOrder.totalAmount)}
              </p>
            </section>

            <section className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">수령 방식</span>
                <span className="font-medium text-gray-900">
                  {completedOrder.fulfillmentType === "DELIVERY" ? "배송" : "픽업"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">이름</span>
                <span className="font-medium text-gray-900">{completedOrder.customerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">연락처</span>
                <span className="font-medium text-gray-900">{completedOrder.customerPhone}</span>
              </div>
              {completedOrder.fulfillmentType === "DELIVERY" ? (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">주소</span>
                  <span className="font-medium text-gray-900 text-right">{completedOrder.deliveryAddress}</span>
                </div>
              ) : (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">픽업 시간</span>
                  <span className="font-medium text-gray-900">{completedOrder.pickupTime}</span>
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={() => {
                setCompletedOrder(null);
                router.push("/");
              }}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold text-sm min-h-[48px]"
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
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-green-800">주문 정보</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          배송 또는 픽업 정보를 확인하고 주문을 완료해주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border">
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">수령 방식</legend>
            <div className="grid grid-cols-2 gap-2">
              {FULFILLMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex flex-col border rounded-xl px-3 py-3 cursor-pointer transition ${
                    fulfillmentType === option.value ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={fulfillmentType === option.value}
                    onChange={() => setFulfillmentType(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{option.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="bg-white border border-green-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">배송 프로필</h2>
                <p className="text-xs text-gray-500 mt-0.5">이름, 연락처, 주소를 한 번에 저장합니다.</p>
              </div>
              <button
                type="button"
                onClick={handleSaveShippingProfile}
                className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold"
              >
                배송 정보 저장
              </button>
            </div>

            {shippingProfiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">최근 배송 정보</p>
                {shippingProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                      selectedProfileId === profile.id ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => applyShippingProfile(profile)}
                      className="flex-1 text-left text-sm text-gray-700 hover:text-green-700"
                    >
                      <span className="font-semibold">{profile.name}</span>
                      <span className="text-gray-500"> ({profile.phone})</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {profile.address}
                        {profile.entrance && ` (${profile.entrance})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShippingProfile(profile.id)}
                      className="text-gray-400 hover:text-red-500 text-sm min-h-[32px]"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
            {profileMessage && <p className="text-xs text-green-700">{profileMessage}</p>}
          </section>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="010-0000-0000"
            />
          </div>

          {isDelivery ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">배달 주소 *</label>
                <input
                  required
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="예: 서울시 강남구 123-4, 101호"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공동현관 출입정보</label>
                <input
                  value={deliveryEntrance}
                  onChange={(event) => setDeliveryEntrance(event.target.value)}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="예: 자유 출입, 비밀번호 #1234"
                />
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
                <p className="font-semibold text-gray-800 mb-1">픽업 매장</p>
                <p className="text-gray-700">{STORE.name}</p>
                <p className="text-gray-600 mt-1">{STORE.address}</p>
                <p className="text-gray-500 text-xs mt-2">결제는 매장에서 진행합니다.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">픽업 예정 시간 *</label>
                <select
                  required
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="">시간을 선택해주세요</option>
                  {PICKUP_TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isDelivery && (
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">결제 방법 *</legend>
              <div className="space-y-2">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2.5 border rounded-xl px-3 py-3 cursor-pointer transition min-h-[44px] ${
                      paymentMethod === option.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={() => setPaymentMethod(option.value)}
                      className="accent-green-600"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
              {paymentMethod === "BANK_TRANSFER" && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">입금 계좌 안내</p>
                  <p className="font-mono font-bold text-gray-900">{BANK_ACCOUNT.display}</p>
                  <p className="text-blue-800 text-xs mt-2">
                    주문 확정 후 위 계좌로 입금해주세요. 입금자명은 주문자명과 동일하게 보내주세요.
                  </p>
                </div>
              )}
            </fieldset>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청사항</label>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={2}
              className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              placeholder={isDelivery ? "예: 문 앞에 놓아주세요" : "예: 박스에 포장해주세요"}
            />
          </div>

          <div className="bg-green-50 rounded-xl p-4 text-sm">
            <p className="font-medium text-green-800 mb-1">주문 요약</p>
            <p className="text-gray-600 mb-2">
              {isDelivery ? "배송" : "픽업"}
              {!isDelivery && pickupTime && ` / ${pickupTime}`}
            </p>
            {items.map((item) => (
              <p key={item.productId} className="text-gray-600">
                {item.name} x {item.quantity}
              </p>
            ))}
            <p className="font-bold text-green-700 mt-2">{formatPrice(totalAmount)}</p>
            {!meetsMinimum && (
              <p className="text-amber-700 text-xs mt-2">
                최소 {formatPrice(MIN_ORDER_AMOUNT)} 이상 주문해주세요.
              </p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="flex-1 border text-gray-600 py-3 rounded-xl text-sm font-medium min-h-[48px]"
            >
              이전
            </button>
            <button
              type="submit"
              disabled={loading || !meetsMinimum}
              className="flex-[2] bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition min-h-[48px]"
            >
              {loading ? "처리 중..." : "주문 확정"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
