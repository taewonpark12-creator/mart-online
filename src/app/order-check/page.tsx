"use client";

import { FormEvent, useState } from "react";
import { Header } from "@/components/Header";
import {
  FULFILLMENT_TYPE_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatPickupTimeLabel,
  formatPrice,
  type FulfillmentType,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/types";

type CheckedOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

type CheckedOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  pickupTime?: string | null;
  paymentMethod: PaymentMethod | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: CheckedOrderItem[];
};

export default function OrderCheckPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<CheckedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSearched(false);

    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setError("연락처를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ phone: normalizedPhone });
      const res = await fetch(`/api/orders/check?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "주문 조회에 실패했습니다.");
      }

      setOrders(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 조회에 실패했습니다.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />

      <main className="mx-auto max-w-md px-3 py-6 sm:px-4 sm:py-8">
        <h1 className="mb-2 text-xl font-bold text-green-800">주문 확인</h1>
        <p className="mb-5 text-sm text-gray-500">
          주문 시 입력한 연락처로 최근 주문을 확인할 수 있습니다.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mb-5 space-y-3 rounded-2xl border bg-white p-4 shadow-sm"
        >
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="010-1234-5678"
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "조회 중..." : "주문 조회"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {searched && orders.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-400">
            조회된 주문이 없습니다.
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-gray-900">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${ORDER_STATUS_COLOR[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </div>

              <div className="mb-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
                <p>
                  {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
                  {order.fulfillmentType === "PICKUP" && order.pickupTime
                    ? ` · ${formatPickupTimeLabel(order.pickupTime)}`
                    : ""}
                </p>
                {order.fulfillmentType === "DELIVERY" && (
                  <p className="mt-1 text-xs text-green-700">{order.deliveryAddress}</p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {item.productName || "상품"} x {item.quantity}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {formatPrice(Number(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between border-t pt-3 font-black">
                <span>총액</span>
                <span className="text-green-700">{formatPrice(Number(order.totalAmount))}</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
