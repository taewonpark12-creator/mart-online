"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import {
  formatPrice,
  MIN_ORDER_AMOUNT,
  PAYMENT_METHOD_OPTIONS,
  OUT_OF_STOCK_POLICY_OPTIONS,
  FULFILLMENT_OPTIONS,
  PICKUP_TIME_SLOTS,
  BANK_ACCOUNT,
  type PaymentMethod,
  type OutOfStockPolicy,
  type FulfillmentType,
  type CartItem,
} from "@/lib/types";
import { parseJsonResponse } from "@/lib/fetch-json";
import { STORE } from "@/lib/store";

const SHIPPING_PROFILES_KEY = "shippingProfiles";
const MAX_SHIPPING_PROFILES = 5;

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

function getPaymentMethodLabel(paymentMethod?: PaymentMethod) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentMethod)?.label ?? "매장 결제";
}

function getFulfillmentLabel(fulfillmentType: FulfillmentType) {
  return FULFILLMENT_OPTIONS.find((option) => option.value === fulfillmentType)?.label ?? fulfillmentType;
}

function sortProfiles(profiles: ShippingProfile[]) {
  return profiles
    .filter((profile) => profile.name && profile.phone && profile.address)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SHIPPING_PROFILES);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart, replaceItems } = useCart();
  const submitLockRef = useRef(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("DELIVERY");
  const [address, setAddress] = useState("");
  const [deliveryEntrance, setDeliveryEntrance] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONSITE_CARD");
  const [outOfStockPolicy, setOutOfStockPolicy] = useState<OutOfStockPolicy>("CONTACT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [clientOrderId, setClientOrderId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  const isDelivery = fulfillmentType === "DELIVERY";
  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;
  const hasOutOfStockItem = items.some((item) => item.isOutOfStock);

  useEffect(() => {
    if (items.length === 0 && !completedOrder) {
      router.push("/cart");
    }
  }, [items, completedOrder, router]);

  useEffect(() => {
    const saved = localStorage.getItem(SHIPPING_PROFILES_KEY);
    if (!saved) return;

    try {
      const profiles = sortProfiles(JSON.parse(saved));
      setShippingProfiles(profiles);
      if (profiles[0]) {
        applyShippingProfile(profiles[0], "최근 배송 정보를 자동으로 불러왔습니다.");
      }
    } catch (e) {
      console.error("Failed to load shipping profiles:", e);
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
      setProfileMessage("이름, 연락처, 주소를 모두 입력한 뒤 저장해주세요.");
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
    if (selectedProfileId === id) {
      setSelectedProfileId("");
    }
    setProfileMessage("저장된 배송 정보를 삭제했습니다.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || submitLockRef.current) return;
    submitLockRef.current = true;

    if (!meetsMinimum) {
      submitLockRef.current = false;
      setError(`최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
      return;
    }
    if (hasOutOfStockItem) {
      submitLockRef.current = false;
      setError("품절된 상품이 장바구니에 있습니다. 해당 상품을 제거 후 주문해주세요.");
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
        items: items.map((i) => ({
          productId: i.productId,
          barcode: i.barcode,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          normalPrice: i.normalPrice,
          eventPrice: i.eventPrice,
          discountRate: i.discountRate,
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
        if (Array.isArray(validationData.updatedCart)) {
          replaceItems(validationData.updatedCart);
        }
        if (validationData.code === "PRICE_CHANGED") {
          throw new Error("상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.");
        }
        if (validationData.code === "PRICE_SOURCE_UNAVAILABLE") {
          throw new Error("가격 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        if (validationData.code === "OUT_OF_STOCK") {
          throw new Error(validationData.error ?? "품절된 상품이 포함되어 있습니다.");
        }
        if (validationData.code === "MIN_ORDER_AMOUNT_CHANGED") {
          throw new Error(validationData.error ?? `최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
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
          outOfStockPolicy,
          totalAmount,
          items: items.map((i) => ({
            productId: i.productId,
            barcode: i.barcode,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            normalPrice: i.normalPrice,
            eventPrice: i.eventPrice,
            discountRate: i.discountRate,
          })),
        }),
      });

      const data = await parseJsonResponse<{
        orderNumber?: string;
        error?: string;
        code?: string;
        updatedCart?: CartItem[];
      }>(res);
      if (!res.ok) {
        if (Array.isArray(data.updatedCart)) {
          replaceItems(data.updatedCart);
        }
        if (data.code === "PRICE_CHANGED") {
          throw new Error("상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.");
        }
        if (data.code === "PRICE_SOURCE_UNAVAILABLE") {
          throw new Error("가격 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        if (data.code === "OUT_OF_STOCK") {
          throw new Error(data.error ?? "재고가 부족한 상품이 포함되어 있습니다.");
        }
        if (data.code === "MIN_ORDER_AMOUNT_CHANGED") {
          throw new Error(data.error ?? `최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
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
      setClientOrderId(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const isNetworkError =
        !message ||
        message.toLowerCase().includes("fetch") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("failed");
      setError(isNetworkError ? "주문을 접수하지 못했습니다. 잠시 후 다시 시도해주세요." : message);
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  if (completedOrder) {
    const isCompletedDelivery = completedOrder.fulfillmentType === "DELIVERY";

    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />
        <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="bg-white border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="text-center mb-6">
              <span className="text-4xl sm:text-5xl block mb-3">완료</span>
              <h1 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">
                주문이 접수되었습니다
              </h1>
              <p className="text-sm text-gray-500">
                주문번호{" "}
                <span className="font-mono font-bold text-gray-900">
                  {completedOrder.orderNumber}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <section>
                <h2 className="text-sm font-bold text-gray-900 mb-2">주문 상품</h2>
                <div className="divide-y border rounded-xl overflow-hidden">
                  {completedOrder.items.map((item) => (
                    <div key={item.productId} className="p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatPrice(item.price)} x {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-green-700 shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-between text-base font-bold border-t pt-4">
                <span>총 주문 금액</span>
                <span className="text-green-700">{formatPrice(completedOrder.totalAmount)}</span>
              </div>

              <section className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">수령 방식</span>
                  <span className="font-medium text-gray-900">
                    {getFulfillmentLabel(completedOrder.fulfillmentType)}
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
                {isCompletedDelivery ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">주소</span>
                      <span className="font-medium text-gray-900 text-right">
                        {completedOrder.deliveryAddress}
                      </span>
                    </div>
                    {completedOrder.deliveryEntrance && (
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">출입 정보</span>
                        <span className="font-medium text-gray-900 text-right">
                          {completedOrder.deliveryEntrance}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">결제 방법</span>
                      <span className="font-medium text-gray-900">
                        {getPaymentMethodLabel(completedOrder.paymentMethod)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">픽업 시간</span>
                    <span className="font-medium text-gray-900">{completedOrder.pickupTime}</span>
                  </div>
                )}
              </section>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  router.push("/");
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold text-sm min-h-[48px]"
              >
                계속 쇼핑하기
              </button>
            </div>
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

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">수령 방식 *</legend>
            <div className="grid grid-cols-2 gap-2">
              {FULFILLMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col border rounded-xl px-3 py-4 cursor-pointer transition min-h-[44px] ${
                    fulfillmentType === opt.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-green-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value={opt.value}
                    checked={fulfillmentType === opt.value}
                    onChange={() => setFulfillmentType(opt.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{opt.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="bg-white border border-green-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">배송 프로필</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  이름, 연락처, 주소를 한 번에 저장합니다.
                </p>
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
                      selectedProfileId === profile.id
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-100"
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
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setPhone(e.target.value)}
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
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="예: 숭의동 123-4, 101호"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  공동현관 출입정보
                </label>
                <input
                  value={deliveryEntrance}
                  onChange={(e) => setDeliveryEntrance(e.target.value)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  픽업 예정 시간 *
                </label>
                <select
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
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
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 border rounded-xl px-3 py-3 cursor-pointer transition min-h-[44px] ${
                      paymentMethod === opt.value
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.value}
                      checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)}
                      className="accent-green-600"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              {paymentMethod === "BANK_TRANSFER" && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">입금 계좌 안내</p>
                  <p className="font-mono font-bold text-gray-900">{BANK_ACCOUNT.display}</p>
                  <p className="text-blue-800 text-xs mt-2">
                    주문 확정 후 위 계좌로 입금해주세요. 입금자명은 주문자 성함으로 보내주시면 확인이 빠릅니다.
                  </p>
                </div>
              )}
            </fieldset>
          )}

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">품절 시 처리 *</legend>
            <div className="space-y-2">
              {OUT_OF_STOCK_POLICY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 border rounded-xl px-3 py-3 cursor-pointer transition min-h-[44px] ${
                    outOfStockPolicy === opt.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-green-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="outOfStockPolicy"
                    value={opt.value}
                    checked={outOfStockPolicy === opt.value}
                    onChange={() => setOutOfStockPolicy(opt.value)}
                    className="accent-green-600"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청사항</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              placeholder={isDelivery ? "예: 문 앞에 놓아주세요" : "예: 박스에 포장해주세요"}
            />
          </div>

          <div className="bg-green-50 rounded-xl p-4 text-sm">
            <p className="font-medium text-green-800 mb-1">주문 요약</p>
            <p className="text-gray-600 mb-2">
              {isDelivery ? "배송" : "픽업"}
              {!isDelivery && pickupTime && ` · ${pickupTime}`}
            </p>
            {items.map((i) => (
              <p key={i.productId} className="text-gray-600">
                {i.name} x {i.quantity}
              </p>
            ))}
            <p className="font-bold text-green-700 mt-2">{formatPrice(totalAmount)}</p>
            {hasOutOfStockItem && (
              <p className="text-red-700 text-xs mt-2">
                품절된 상품은 주문할 수 없습니다. 장바구니에서 제거해주세요.
              </p>
            )}
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
              disabled={loading || !meetsMinimum || hasOutOfStockItem}
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
