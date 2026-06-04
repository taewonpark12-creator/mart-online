"use client";

import { useState, useEffect } from "react";
import type { CartItem } from "@/lib/types";
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
import { ProductImage } from "@/components/ProductImage";

interface SavedAddress {
  id: string;
  address: string;
  entrance?: string;
}

type Props = {
  items: CartItem[];
  totalAmount: number;
  onClose: () => void;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onOrderComplete: () => void;
};

export function CartDrawer({
  items,
  totalAmount,
  onClose,
  onUpdateQuantity,
  onRemove,
  onOrderComplete,
}: Props) {
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
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

  const isDelivery = fulfillmentType === "DELIVERY";
  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;
  const amountShort = MIN_ORDER_AMOUNT - totalAmount;

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

      setOrderNumber(data.orderNumber);
      setStep("done");
      onOrderComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md sm:max-w-lg bg-white h-[70vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-1 bg-gray-300 rounded-full sm:hidden" />
            <h2 className="font-bold text-base sm:text-lg">
              {step === "cart" && "장바구니"}
              {step === "checkout" && "주문 정보"}
              {step === "done" && "주문 완료"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {step === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
              {items.length === 0 ? (
                <p className="text-center text-gray-400 py-12">장바구니가 비어 있습니다.</p>
              ) : (
                items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 sm:gap-3 bg-gray-50 rounded-xl p-2.5 sm:p-3">
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="56px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
                      <p className="text-green-700 font-semibold text-xs sm:text-sm">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                        className="w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-white border text-sm sm:text-base font-bold min-h-[44px]"
                      >
                        −
                      </button>
                      <span className="w-8 sm:w-6 text-center text-sm sm:text-base font-medium">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                        disabled={!!(item.maxOrderQuantity && item.maxOrderQuantity > 0 && item.quantity >= item.maxOrderQuantity)}
                        className="w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-white border text-sm sm:text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => onRemove(item.productId)}
                      className="text-gray-300 hover:text-red-400 text-lg sm:text-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t px-4 sm:px-5 py-4 space-y-3">
                <div className="flex justify-between font-bold text-base sm:text-lg">
                  <span>합계</span>
                  <span className="text-green-700">{formatPrice(totalAmount)}</span>
                </div>
                {!meetsMinimum && (
                  <p className="text-xs sm:text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                    {formatPrice(MIN_ORDER_AMOUNT)} 이상 주문 가능합니다.{" "}
                    <span className="font-medium">{formatPrice(amountShort)}</span> 더 담아주세요.
                  </p>
                )}
                <button
                  onClick={() => meetsMinimum && setStep("checkout")}
                  disabled={!meetsMinimum}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 sm:py-3 rounded-xl transition text-sm sm:text-base min-h-[44px]"
                >
                  주문하기
                </button>
              </div>
            )}
          </>
        )}

        {step === "checkout" && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-5 py-4 space-y-4 flex-1">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
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
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="010-0000-0000"
                />
              </div>

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
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="숭의동 123-4, 101호"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      공동현관 출입정보
                    </label>
                    <input
                      value={deliveryEntrance}
                      onChange={(e) => setDeliveryEntrance(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
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
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
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
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder={
                    isDelivery
                      ? "예: 문 앞에 놔주세요"
                      : "예: 박스에 포장해주세요"
                  }
                />
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-sm">
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
            </div>
            <div className="border-t px-5 py-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("cart")}
                className="flex-1 border text-gray-600 py-3 rounded-xl text-sm font-medium min-h-[44px]"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading || !meetsMinimum}
                className="flex-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition min-h-[44px]"
              >
                {loading ? "처리 중..." : "주문 확정"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <span className="text-6xl">✅</span>
            <h3 className="text-xl font-bold text-green-800">주문이 접수되었습니다!</h3>
            <p className="text-gray-500 text-sm">
              주문번호: <span className="font-mono font-bold text-gray-800">{orderNumber}</span>
            </p>
            <p className="text-sm text-gray-500">
              {isDelivery ? (
                <>
                  주문이 확인되면 배달 준비 후 연락드립니다.
                  <br />
                  입력하신 주소로 배달해 드립니다.
                </>
              ) : (
                <>
                  <span className="font-medium text-gray-700">
                    픽업 예정: {pickupTime}경
                  </span>
                  <br />
                  {STORE.name} ({STORE.address})
                  <br />
                  결제는 매장에서 진행해 주세요.
                </>
              )}
            </p>
            {isDelivery && paymentMethod === "BANK_TRANSFER" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-left w-full">
                <p className="font-semibold text-blue-900 mb-1">입금 계좌</p>
                <p className="font-mono font-bold text-gray-900">{BANK_ACCOUNT.display}</p>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 bg-green-600 text-white px-8 py-3 rounded-xl font-semibold min-h-[44px]"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
