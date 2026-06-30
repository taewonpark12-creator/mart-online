"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { CHECKOUT_CUTOFF_NOTICE } from "@/lib/delivery-schedule";
import { formatCartPriceChangeNotice, syncCartPricesWithLatestSource } from "@/lib/cart-price-sync";
import {
  MIN_ORDER_AMOUNT,
  formatPrice,
  PAYMENT_METHOD_OPTIONS,
  OUT_OF_STOCK_POLICY_OPTIONS,
} from "@/lib/types";

const PICKUP_TIMES = [
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
];

const INITIAL_FORM = {
  customerName: "",
  customerPhone: "",
  fulfillmentType: "DELIVERY",
  deliveryAddress: "",
  pickupTime: "09:30",
  memo: "",
  outOfStockPolicy: "CONTACT",
  paymentMethod: "ONSITE_CARD",
  saveInfo: false,
};

type CheckoutForm = typeof INITIAL_FORM;

const NETWORK_ERROR_MESSAGE =
  "인터넷 연결이 불안정해 주문을 접수하지 못했습니다. 장바구니는 그대로 보관되어 있으니 잠시 후 다시 눌러주세요.";
const SERVER_ERROR_MESSAGE =
  "주문 접수 중 문제가 발생했습니다. 장바구니는 그대로 보관되어 있으니 잠시 후 다시 시도해주세요.";

function getOrderErrorMessage(status: number, result: any) {
  const code = typeof result?.error === "string" ? result.error : "";
  const changedItems = Array.isArray(result?.changedItems) ? result.changedItems : [];
  const unavailableItems = Array.isArray(result?.unavailableItems) ? result.unavailableItems : [];

  if (code === "PRICE_CHANGED" && changedItems.length > 0) {
    const itemMessages = changedItems
      .slice(0, 3)
      .map((item: any) => {
        const name = String(item?.productName || "상품");
        const previousPrice = Number(item?.previousPrice);
        const currentPrice = Number(item?.currentPrice);
        if (Number.isFinite(previousPrice) && Number.isFinite(currentPrice)) {
          return `${name}: ${formatPrice(previousPrice)} → ${formatPrice(currentPrice)}`;
        }
        return name;
      })
      .join("\n");
    const extraCount = changedItems.length > 3 ? `\n외 ${changedItems.length - 3}개 상품` : "";

    return `상품 가격이 변경되어 주문을 접수하지 않았습니다.\n${itemMessages}${extraCount}\n장바구니에서 가격을 확인한 뒤 다시 주문해주세요.`;
  }

  if (code === "UNAVAILABLE_ORDER_ITEMS" && unavailableItems.length > 0) {
    const itemMessages = unavailableItems
      .slice(0, 3)
      .map((item: any) => {
        const name = String(item?.productName || "상품");
        const reason = String(item?.reason || "주문할 수 없습니다.");
        return `${name}: ${reason}`;
      })
      .join("\n");
    const extraCount = unavailableItems.length > 3 ? `\n외 ${unavailableItems.length - 3}개 상품` : "";

    return `주문할 수 없는 상품이 포함되어 주문을 접수하지 않았습니다.\n${itemMessages}${extraCount}\n장바구니를 확인해주세요.`;
  }

  if (code === "PRICE_SOURCE_UNAVAILABLE") {
    return "상품 가격 정보를 확인할 수 없어 주문을 접수하지 않았습니다. 장바구니는 그대로 보관되어 있으니 잠시 후 다시 시도해주세요.";
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  if (code === "MISSING_CUSTOMER_INFO") {
    return "고객명과 전화번호를 입력해주세요.";
  }

  if (code === "MISSING_DELIVERY_ADDRESS") {
    return "배송 주소를 입력해주세요.";
  }

  if (code === "MISSING_PICKUP_TIME") {
    return "픽업 시간을 선택해주세요.";
  }

  if (code === "INVALID_ITEMS") {
    return "장바구니 상품 정보를 확인할 수 없습니다. 상품을 다시 담아주세요.";
  }

  return SERVER_ERROR_MESSAGE;
}

function pickupLabel(value: string) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "오후" : "오전";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${period} ${String(displayHour).padStart(2, "0")}:${minute}`;
}

function toOrderItem(item: any) {
  const productId = String(item.productId ?? "").trim();
  const productName = String(item.name ?? "").trim();
  const price = Number(item.unitPrice ?? item.price);
  const quantity = Number(item.quantity);

  if (
    !productId ||
    !productName ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return {
    productId,
    productName,
    price,
    unitPrice: price,
    quantity,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart, replaceItems, loaded } = useCart();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [priceNotice, setPriceNotice] = useState("");
  const [syncingPrices, setSyncingPrices] = useState(true);
  const [skipEmptyCartCheck, setSkipEmptyCartCheck] = useState(false);
  const [showCutoffNotice, setShowCutoffNotice] = useState(false);
  const submitLockRef = useRef(false);
  const checkedLatestPricesRef = useRef(false);

  // Load saved delivery info from localStorage
  useEffect(() => {
    try {
      const savedInfo = localStorage.getItem("deliveryInfo");
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        setForm((current) => ({
          ...current,
          customerName: parsed.customerName || "",
          customerPhone: parsed.customerPhone || "",
          deliveryAddress: parsed.deliveryAddress || "",
        }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    fetch("/api/orders/cutoff")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore) {
          setShowCutoffNotice(Boolean(data?.afterCutoff));
        }
      })
      .catch((error) => {
        console.error("[CHECKOUT_CUTOFF_NOTICE_ERROR]", error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || checkedLatestPricesRef.current) return;
    checkedLatestPricesRef.current = true;

    let ignore = false;
    setSyncingPrices(true);

    syncCartPricesWithLatestSource(items)
      .then((result) => {
        if (ignore) return;

        if (result.changes.length > 0) {
          replaceItems(result.items);
          setPriceNotice(formatCartPriceChangeNotice(result.changes));
          setError("");
        }
      })
      .catch((syncError) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[checkout-price-sync] failed", syncError);
        }
      })
      .finally(() => {
        if (!ignore) {
          setSyncingPrices(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [items, loaded, replaceItems]);

  const isDelivery = form.fulfillmentType === "DELIVERY";
  const deliveryBlocked = isDelivery && totalAmount < MIN_ORDER_AMOUNT;
  const canSubmit = Boolean(
    !submitting &&
    !syncingPrices &&
    !deliveryBlocked &&
    items.length > 0 &&
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    (isDelivery ? form.deliveryAddress.trim() : form.pickupTime)
  );

  const update = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitLockRef.current) return;

    const orderItems = items.map(toOrderItem);
    if (orderItems.some((item) => item === null)) {
      setError("장바구니 상품 정보를 확인할 수 없습니다. 상품을 다시 담아주세요.");
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setError("");

    // Save delivery info if requested
    if (isDelivery && form.saveInfo) {
      try {
        localStorage.setItem(
          "deliveryInfo",
          JSON.stringify({
            customerName: form.customerName.trim(),
            customerPhone: form.customerPhone.trim(),
            deliveryAddress: form.deliveryAddress.trim(),
          }),
        );
      } catch {
        /* ignore */
      }
    }

    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      fulfillmentType: form.fulfillmentType,
      deliveryAddress: isDelivery ? form.deliveryAddress.trim() : undefined,
      pickupTime: !isDelivery ? form.pickupTime : undefined,
      memo: form.memo.trim() || undefined,
      outOfStockPolicy: form.outOfStockPolicy,
      paymentMethod: isDelivery ? form.paymentMethod : undefined,
      items: orderItems,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.orderNumber) {
        setError(getOrderErrorMessage(res.status, result));
        return;
      }

      const orderNumber = result.orderNumber;

      setSkipEmptyCartCheck(true);
      clearCart();
      setForm(INITIAL_FORM);
      router.replace(`/order-complete?orderNumber=${encodeURIComponent(orderNumber)}`);
    } catch (error) {
      console.error("[CHECKOUT_SUBMIT_ERROR]", error);
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  if (items.length === 0 && !skipEmptyCartCheck) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="bg-white border rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-500 mb-4">장바구니가 비어 있습니다.</p>
            <button
              onClick={() => router.push("/")}
              className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold"
            >
              쇼핑하러 가기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <main className="mx-auto max-w-md px-4 py-6 pb-44 sm:py-8 sm:pb-8">
        <h1 className="text-2xl font-bold text-green-800 mb-6">주문하기</h1>

        {showCutoffNotice && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900 shadow-sm">
            {CHECKOUT_CUTOFF_NOTICE}
          </div>
        )}

        {priceNotice && (
          <div className="mb-5 whitespace-pre-line rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900 shadow-sm">
            {priceNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-base font-bold text-gray-900">수령 방법</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "배송", value: "DELIVERY" },
                { label: "픽업", value: "PICKUP" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("fulfillmentType", option.value)}
                  className={`min-h-[52px] rounded-xl border p-3 text-base font-bold ${
                    form.fulfillmentType === option.value
                      ? "border-green-500 bg-green-50 text-green-900"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-bold text-gray-900">고객 정보</legend>
            <input
              required
              value={form.customerName}
              onChange={(event) => update("customerName", event.target.value)}
              placeholder="고객명"
              autoComplete="name"
              className="w-full min-h-[52px] rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.customerPhone}
              onChange={(event) => update("customerPhone", event.target.value)}
              placeholder="전화번호"
              className="w-full min-h-[52px] rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-400"
            />
          </fieldset>

          {isDelivery ? (
            <fieldset className="space-y-3">
              <legend className="text-base font-bold text-gray-900">배송 정보</legend>
              <input
                required
                value={form.deliveryAddress}
                onChange={(event) => update("deliveryAddress", event.target.value)}
                placeholder="배송 주소"
                autoComplete="street-address"
                className="w-full min-h-[52px] rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-400"
              />
              {deliveryBlocked && (
                <p className="text-sm font-semibold text-red-500">
                  배송 주문은 {formatPrice(MIN_ORDER_AMOUNT)} 이상이어야 합니다.
                </p>
              )}
              <label className="flex min-h-[48px] items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={form.saveInfo}
                  onChange={(event) => update("saveInfo", event.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-400"
                />
                <span className="text-gray-700">기본정보 저장</span>
              </label>
            </fieldset>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-base font-bold text-gray-900">픽업 정보</legend>
              <select
                required
                value={form.pickupTime}
                onChange={(event) => update("pickupTime", event.target.value)}
                className="w-full min-h-[52px] rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-400"
              >
                {PICKUP_TIMES.map((time) => (
                  <option key={time} value={time}>
                    {pickupLabel(time)}
                  </option>
                ))}
              </select>
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-base font-bold text-gray-900">품절 시 처리방법</legend>
            <div className="grid gap-2">
              {OUT_OF_STOCK_POLICY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-[54px] cursor-pointer items-center rounded-xl border px-4 py-3 text-base font-bold transition ${
                    form.outOfStockPolicy === option.value
                      ? "border-green-500 bg-green-50 text-green-900"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="outOfStockPolicy"
                    value={option.value}
                    checked={form.outOfStockPolicy === option.value}
                    onChange={(event) => update("outOfStockPolicy", event.target.value)}
                    className="sr-only"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {isDelivery && (
            <fieldset className="space-y-3">
              <legend className="text-base font-bold text-gray-900">결제 방법</legend>
              <div className="grid gap-2">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-[54px] cursor-pointer items-center rounded-xl border px-4 py-3 text-base font-bold transition ${
                      form.paymentMethod === option.value
                        ? "border-green-500 bg-green-50 text-green-900"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={form.paymentMethod === option.value}
                      onChange={(event) => update("paymentMethod", event.target.value)}
                      className="sr-only"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {form.paymentMethod === "BANK_TRANSFER" && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-2">
                  <p className="text-xs text-blue-800 font-semibold">계좌번호</p>
                  <p className="text-sm text-blue-900 font-bold">국민은행 654937-01-011941 한사랑마트</p>
                  <p className="text-xs text-blue-700 mt-2">품절 상품이 있을 수 있으니 매장에서 연락드린 후 계좌이체해주세요.</p>
                </div>
              )}
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-base font-bold text-gray-900">요청사항</legend>
            <textarea
              value={form.memo}
              onChange={(event) => update("memo", event.target.value)}
              placeholder="요청사항을 입력하세요 (선택)"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-400"
            />
          </fieldset>

          <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-base font-bold text-gray-900">주문 내역</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between gap-3 text-sm sm:text-base">
                  <span className="min-w-0 truncate">
                    {item.name} x {item.quantity}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t pt-3 text-base font-black">
              <span>총액</span>
              <span className="text-green-700">{formatPrice(totalAmount)}</span>
            </div>
          </section>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] sm:static sm:rounded-xl sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="mx-auto max-w-md space-y-2">
              {error && (
                <p className="whitespace-pre-line rounded-xl bg-red-50 px-3 py-2 text-sm font-bold leading-5 text-red-700">
                  {error}
                </p>
              )}
              {deliveryBlocked && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                  {formatPrice(MIN_ORDER_AMOUNT)} 이상 배송 주문 가능합니다.
                </p>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-4 text-base font-bold text-white hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed min-h-[54px]"
              >
                {submitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {submitting ? "주문 접수 중..." : "주문하기"}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="hidden w-full rounded-xl border px-4 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50 sm:block"
              >
                뒤로 가기
              </button>
              <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
