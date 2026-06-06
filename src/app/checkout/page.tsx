"use client";

import { useState, useEffect } from "react";
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
} from "@/lib/types";
import { parseJsonResponse } from "@/lib/fetch-json";
import { STORE } from "@/lib/store";

interface SavedAddress {
  id: string;
  address: string;
  entrance?: string;
}

interface SavedCustomer {
  id: string;
  name: string;
  phone: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();
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
  const [orderNumber, setOrderNumber] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSaveAddress, setShowSaveAddress] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [showSaveCustomer, setShowSaveCustomer] = useState(false);

  const isDelivery = fulfillmentType === "DELIVERY";
  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;

  // 장바구니가 비어있으면 장바구니 페이지로 이동
  useEffect(() => {
    if (items.length === 0) {
      router.push("/cart");
    }
  }, [items, router]);

  // Load saved addresses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("savedAddresses");
    if (saved) {
      try {
        setSavedAddresses(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved addresses:", e);
      }
    }
  }, []);

  // Load saved customers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("savedCustomers");
    if (saved) {
      try {
        setSavedCustomers(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved customers:", e);
      }
    }
  }, []);

  const handleSaveAddress = () => {
    if (!address) return;
    
    const newAddress: SavedAddress = {
      id: Date.now().toString(),
      address,
      entrance: deliveryEntrance || undefined,
    };
    
    const updated = [...savedAddresses, newAddress];
    setSavedAddresses(updated);
    localStorage.setItem("savedAddresses", JSON.stringify(updated));
    setShowSaveAddress(false);
  };

  const handleSelectAddress = (saved: SavedAddress) => {
    setAddress(saved.address);
    setDeliveryEntrance(saved.entrance || "");
  };

  const handleDeleteAddress = (id: string) => {
    const updated = savedAddresses.filter(a => a.id !== id);
    setSavedAddresses(updated);
    localStorage.setItem("savedAddresses", JSON.stringify(updated));
  };

  const handleSaveCustomer = () => {
    if (!name || !phone) return;
    
    const newCustomer: SavedCustomer = {
      id: Date.now().toString(),
      name,
      phone,
    };
    
    const updated = [...savedCustomers, newCustomer];
    setSavedCustomers(updated);
    localStorage.setItem("savedCustomers", JSON.stringify(updated));
    setShowSaveCustomer(false);
  };

  const handleSelectCustomer = (saved: SavedCustomer) => {
    setName(saved.name);
    setPhone(saved.phone);
  };

  const handleDeleteCustomer = (id: string) => {
    const updated = savedCustomers.filter(c => c.id !== id);
    setSavedCustomers(updated);
    localStorage.setItem("savedCustomers", JSON.stringify(updated));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetsMinimum) {
      setError(`최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
      return;
    }
    if (!isDelivery && !pickupTime) {
      setError("픽업 예정 시각을 선택해 주세요.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          fulfillmentType,
          deliveryAddress: isDelivery ? address : undefined,
          deliveryEntrance: isDelivery ? deliveryEntrance.trim() || undefined : undefined,
          pickupTime: isDelivery ? undefined : pickupTime,
          memo,
          paymentMethod: isDelivery ? paymentMethod : undefined,
          outOfStockPolicy,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });

      const data = await parseJsonResponse<{ orderNumber?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "주문에 실패했습니다.");
      if (!data.orderNumber) throw new Error("주문번호를 받지 못했습니다.");

      // 주문 완료 후 장바구니 비우기
      clearCart();
      
      // 주문 완료 페이지로 이동 (주문번호 전달)
      router.push(`/order-complete?orderNumber=${data.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-green-800">주문 정보</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          배송/픽업 정보를 입력하고 주문을 완료하세요.
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

          {savedCustomers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">저장된 고객 정보</label>
              <div className="space-y-2">
                {savedCustomers.map((saved) => (
                  <div key={saved.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(saved)}
                      className="flex-1 text-left text-sm text-gray-700 hover:text-green-700"
                    >
                      {saved.name} ({saved.phone})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(saved.id)}
                      className="text-gray-400 hover:text-red-500 text-sm min-h-[32px]"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {name && phone && (
            <button
              type="button"
              onClick={() => setShowSaveCustomer(!showSaveCustomer)}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              {showSaveCustomer ? "저장 취소" : "고객 정보 저장"}
            </button>
          )}

          {showSaveCustomer && (
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-green-800 mb-3">
                현재 입력하신 이름과 연락처를 저장하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomer}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveCustomer(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {isDelivery ? (
            <>
              {savedAddresses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">저장된 배송지</label>
                  <div className="space-y-2">
                    {savedAddresses.map((saved) => (
                      <div key={saved.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAddress(saved)}
                          className="flex-1 text-left text-sm text-gray-700 hover:text-green-700"
                        >
                          {saved.address}
                          {saved.entrance && ` (${saved.entrance})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(saved.id)}
                          className="text-gray-400 hover:text-red-500 text-sm min-h-[32px]"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  placeholder="예: 자율 출입, 비밀번호 #1234"
                />
              </div>
              {address && (
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  className="text-sm text-green-600 hover:text-green-700 font-medium min-h-[32px]"
                >
                  + 이 배송지 저장
                </button>
              )}
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
                  픽업 예정 시각 *
                </label>
                <select
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                >
                  <option value="">시간을 선택해 주세요</option>
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
                    주문 확정 후 위 계좌로 입금해 주세요. 입금자명은 주문자 성함으로 보내주시면
                    확인이 빠릅니다.
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
              placeholder={
                isDelivery
                  ? "예: 문 앞에 놔주세요"
                  : "예: 박스에 포장해주세요"
              }
            />
          </div>

          <div className="bg-green-50 rounded-xl p-4 text-sm">
            <p className="font-medium text-green-800 mb-1">주문 요약</p>
            <p className="text-gray-600 mb-2">
              {isDelivery ? "배송" : "픽업"}
              {!isDelivery && pickupTime && ` · ${pickupTime}경`}
            </p>
            {items.map((i) => (
              <p key={i.productId} className="text-gray-600">
                {i.name} × {i.quantity}
              </p>
            ))}
            <p className="font-bold text-green-700 mt-2">{formatPrice(totalAmount)}</p>
            {!meetsMinimum && (
              <p className="text-amber-700 text-xs mt-2">
                최소 {formatPrice(MIN_ORDER_AMOUNT)} 이상 주문해 주세요.
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
