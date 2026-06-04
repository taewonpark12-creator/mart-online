"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { parseJsonResponse } from "@/lib/fetch-json";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  FULFILLMENT_TYPE_LABEL,
  formatPaymentMethodLabel,
  formatPickupTimeLabel,
  formatPrice,
  type OrderStatus,
  type PaymentMethod,
  type FulfillmentType,
} from "@/lib/types";
import { orderItemName } from "@/lib/order-item";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  product?: { name: string; imageUrl?: string | null } | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  pickupTime?: string | null;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
};

export default function OrderCheckPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/orders/check?phone=${encodeURIComponent(trimmed)}`);
      const data = await parseJsonResponse<Order[] | { error?: string }>(res);

      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "조회에 실패했습니다.");
      }

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-green-800">주문 내역 조회</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">최근 24시간 이내 주문만 조회됩니다.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="tel"
            placeholder="010-0000-0000"
            className="flex-1 border rounded-xl px-3 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-green-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-60 shrink-0 text-sm"
          >
            {loading ? "조회중" : "조회"}
          </button>
        </div>

        {error && <p className="text-red-500 text-xs sm:text-sm mb-4">{error}</p>}

        <div className="space-y-3 sm:space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2 mb-2">
                <span className="font-mono text-xs sm:text-sm font-bold text-gray-800">{order.orderNumber}</span>
                <span
                  className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">
                {new Date(order.createdAt).toLocaleString("ko-KR")}
              </p>
              <p className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                {order.customerName}님 · {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
                {order.fulfillmentType === "PICKUP" && order.pickupTime
                  ? ` ${formatPickupTimeLabel(order.pickupTime)}`
                  : ""}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">
                {formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}
              </p>
              <div className="text-xs sm:text-sm text-gray-600 space-y-1 border-t pt-1.5 sm:pt-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {orderItemName(item)} × {item.quantity}
                    </span>
                    <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <p className="font-bold text-green-700 text-right mt-1.5 sm:mt-2 text-sm sm:text-base">{formatPrice(order.totalAmount)}</p>
            </div>
          ))}

          {hasSearched && !loading && orders.length === 0 && !error && (
            <p className="text-center text-gray-400 py-10 sm:py-12 text-xs sm:text-sm">최근 24시간 내 주문 내역이 없습니다.</p>
          )}
        </div>

        <Link href="/" className="block text-center text-xs sm:text-sm text-green-600 mt-6 sm:mt-8 hover:underline">
          ← 쇼핑으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
