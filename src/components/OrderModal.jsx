"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/types";
import { getMinimumOrderAmount } from "@/lib/min-order";

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
  fulfillmentType: "PICKUP",
  deliveryAddress: "",
  pickupTime: "09:30",
};

const SAVE_ERROR = "주문 저장에 실패했습니다. 다시 시도해주세요.";

function pickupLabel(value) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "오후" : "오전";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${period} ${String(displayHour).padStart(2, "0")}:${minute}`;
}

function toOrderItem(item) {
  const productId = String(item.productId ?? "").trim();
  const productName = String(item.name ?? "").trim();
  const price = Number(item.price);
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
    quantity,
  };
}

export default function OrderModal({ open, onClose }) {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isDelivery = form.fulfillmentType === "DELIVERY";
  const minimumOrderAmount = getMinimumOrderAmount();
  const deliveryBlocked = isDelivery && totalAmount < minimumOrderAmount;
  const canSubmit =
    !submitting &&
    !deliveryBlocked &&
    items.length > 0 &&
    form.customerName.trim() &&
    form.customerPhone.trim() &&
    (isDelivery ? form.deliveryAddress.trim() : form.pickupTime);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (!submitting) onClose();
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const orderItems = items.map(toOrderItem);
    if (orderItems.some((item) => item === null)) {
      alert(SAVE_ERROR);
      return;
    }

    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      fulfillmentType: form.fulfillmentType,
      deliveryAddress: isDelivery ? form.deliveryAddress.trim() : undefined,
      pickupTime: !isDelivery ? form.pickupTime : undefined,
      items: orderItems,
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => null);
      console.log("ORDER_CREATE_STATUS", res.status);
      console.log("ORDER_CREATE_RESULT", result);

      if (!res.ok || !result?.orderNumber) {
        alert(result?.error || result?.message || SAVE_ERROR);
        return;
      }

      try {
        localStorage.setItem(
          "completedOrder",
          JSON.stringify({ orderNumber: result.orderNumber }),
        );
      } catch {
        /* ignore */
      }

      clearCart();
      setForm(INITIAL_FORM);
      onClose();
      router.push("/order-complete");
    } catch (error) {
      console.error("[ORDER_MODAL_SUBMIT_ERROR]", error);
      alert(SAVE_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-6"
      onClick={close}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                Order
              </p>
              <h2 className="mt-1 text-xl font-black text-gray-900">주문하기</h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-full px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            >
              닫기
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-900">고객 정보</legend>
            <input
              required
              value={form.customerName}
              onChange={(event) => update("customerName", event.target.value)}
              placeholder="고객명"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              required
              type="tel"
              value={form.customerPhone}
              onChange={(event) => update("customerPhone", event.target.value)}
              placeholder="전화번호"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-900">수령 방법</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "픽업", value: "PICKUP" },
                { label: "배달", value: "DELIVERY" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("fulfillmentType", option.value)}
                  className={`rounded-xl border p-3 text-sm font-bold ${
                    form.fulfillmentType === option.value
                      ? "border-green-500 bg-green-50 text-green-900"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {isDelivery ? (
              <>
                <input
                  required
                  value={form.deliveryAddress}
                  onChange={(event) => update("deliveryAddress", event.target.value)}
                  placeholder="배달 주소"
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
                {deliveryBlocked && (
                  <p className="text-sm font-semibold text-red-500">
                    배달 주문은 {formatPrice(minimumOrderAmount)} 이상이어야 합니다.
                  </p>
                )}
              </>
            ) : (
              <select
                required
                value={form.pickupTime}
                onChange={(event) => update("pickupTime", event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
              >
                {PICKUP_TIMES.map((time) => (
                  <option key={time} value={time}>
                    {pickupLabel(time)}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">주문 내역</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between gap-3 text-sm">
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {submitting ? "주문 저장 중..." : "주문 완료하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
