"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { MIN_ORDER_AMOUNT, formatPrice } from "@/lib/types";
import { STORE } from "@/lib/store";

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
  phone: "",
  deliveryType: "PICKUP",
  address: "",
  note: "",
  pickupTime: "09:30",
};

const ORDER_SAVE_ERROR = "주문 저장에 실패했습니다. 다시 시도해주세요.";

function formatPickupTime(value) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "오후" : "오전";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${period} ${String(displayHour).padStart(2, "0")}:${minute}`;
}

function normalizeOrderItem(item) {
  const productId = String(item.productId ?? "").trim();
  const price = Number(item.price);
  const quantity = Number(item.quantity);

  if (
    !productId ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return {
    productId,
    name: item.name,
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

  const isDelivery = form.deliveryType === "DELIVERY";
  const deliveryBlocked = isDelivery && totalAmount < MIN_ORDER_AMOUNT;
  const canSubmit =
    !submitting &&
    !deliveryBlocked &&
    items.length > 0 &&
    form.customerName.trim() &&
    form.phone.trim() &&
    (isDelivery ? form.address.trim() : form.pickupTime);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const orderItems = items.map(normalizeOrderItem);
    if (orderItems.some((item) => item === null)) {
      alert(ORDER_SAVE_ERROR);
      return;
    }

    const orderData = {
      customerName: form.customerName.trim(),
      customerPhone: form.phone.trim(),
      fulfillmentType: form.deliveryType,
      deliveryAddress: isDelivery ? form.address.trim() : undefined,
      pickupTime: !isDelivery ? form.pickupTime : undefined,
      memo: form.note.trim() || undefined,
      paymentMethod: isDelivery ? "ONSITE_CASH" : undefined,
      outOfStockPolicy: "CONTACT",
      items: orderItems,
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      const result = await res.json().catch(() => null);
      console.log("ORDER_CREATE_STATUS", res.status);
      console.log("ORDER_CREATE_RESULT", result);

      if (!res.ok) {
        alert(result?.error || result?.message || "주문 저장 실패");
        return;
      }

      if (!result?.orderNumber) {
        alert(result?.error || result?.message || ORDER_SAVE_ERROR);
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
      resetForm();
      onClose();
      router.push("/order-complete");
    } catch (error) {
      console.error("[OrderModal] submit failed", error);
      alert(ORDER_SAVE_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">Order</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-gray-900">주문하기</h2>
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
            <legend className="text-sm font-bold text-gray-900">주문자 정보</legend>
            <label className="block text-sm font-semibold text-gray-700">
              이름 *
              <input
                required
                value={form.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                placeholder="홍길동"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              연락처 *
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="010-1234-5678"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-900">수령 방법</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "픽업", value: "PICKUP", hint: "매장 방문 수령" },
                { label: "배달", value: "DELIVERY", hint: "주소로 배달" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("deliveryType", option.value)}
                  className={`rounded-xl border p-3 text-left transition ${
                    form.deliveryType === option.value
                      ? "border-green-500 bg-green-50 text-green-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-green-200"
                  }`}
                >
                  <strong className="block text-sm">{option.label}</strong>
                  <small className="text-xs text-gray-500">{option.hint}</small>
                </button>
              ))}
            </div>

            {isDelivery ? (
              <>
                <label className="block text-sm font-semibold text-gray-700">
                  배달 주소 *
                  <input
                    required
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder="주소를 입력해주세요"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
                  />
                </label>
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  배달 주문은 {formatPrice(MIN_ORDER_AMOUNT)} 이상 가능합니다.
                </p>
                {deliveryBlocked && (
                  <p className="text-sm font-semibold text-red-500">
                    배달 주문은 {formatPrice(MIN_ORDER_AMOUNT)} 이상이어야 합니다.
                  </p>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-gray-700">
                  픽업 예정 시간 *
                  <select
                    required
                    value={form.pickupTime}
                    onChange={(event) => update("pickupTime", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
                  >
                    {PICKUP_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {formatPickupTime(time)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl bg-green-50 px-3 py-3 text-sm text-green-900">
                  <strong>{STORE.name}</strong>
                  <p className="mt-1 text-xs text-green-700">{STORE.address}</p>
                </div>
              </>
            )}
          </fieldset>

          <label className="block text-sm font-semibold text-gray-700">
            요청사항
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              placeholder="배달 요청사항이나 대체 상품 요청을 입력해주세요"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>

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
              <span>총 결제금액</span>
              <span className="text-green-700">{formatPrice(totalAmount)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              결제는 상품 수령 시 현장에서 진행됩니다.
            </p>
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
