"use client";

import { FormEvent, useState } from "react";
import { Header } from "@/components/Header";
import { formatPrice } from "@/lib/types";

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "신규주문",
  APPROVED: "확인완료",
  DELIVERED: "배송완료",
  CANCELLED: "취소됨",
};

const FULFILLMENT_TYPE_LABEL: Record<string, string> = {
  DELIVERY: "배송",
  PICKUP: "픽업",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ONSITE_CARD: "매장 카드결제",
  ONSITE_CASH: "매장 현금결제",
  BANK_TRANSFER: "계좌이체",
};

const OUT_OF_STOCK_POLICY_LABEL: Record<string, string> = {
  SUBSTITUTE: "대체상품 받기",
  CANCEL_ONLY: "품절된 상품만 취소",
  CONTACT: "연락바람",
};

function maskName(name: string): string {
  if (!name || name.length === 0) return "";
  if (name.length === 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length < 10) return phone;
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-****-${cleaned.slice(6)}`;
  }
  return `${cleaned.slice(0, 3)}-****-${cleaned.slice(7)}`;
}

type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  price: number;
  quantity: number;
  barcode: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryAddress: string;
  pickupTime: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  memo: string | null;
  paymentMethod: string | null;
  outOfStockPolicy: string | null;
  items: OrderItem[];
};

export default function OrderCheckPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSearched(false);

    if (!query.trim()) {
      setError("주문번호 또는 전화번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ q: query.trim() });
      const res = await fetch(`/api/orders/check?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.message || result?.error || "주문 조회 실패");
      }

      setOrders(Array.isArray(result?.orders) ? result.orders : []);
      setSearched(true);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "주문 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-2xl font-black text-green-800">주문 조회</h1>
        <p className="mb-5 text-sm text-gray-500">
          주문번호 또는 주문 시 입력한 전화번호로 조회하세요.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mb-5 space-y-3 rounded-2xl border bg-white p-4 shadow-sm"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="주문번호 또는 전화번호"
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "조회 중..." : "조회하기"}
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
                <div>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </span>
              </div>

              <div className="mb-3 space-y-1 text-sm">
                <p><span className="font-semibold text-gray-600">고객명:</span> {maskName(order.customerName)}</p>
                <p><span className="font-semibold text-gray-600">연락처:</span> {maskPhone(order.customerPhone)}</p>
                <p><span className="font-semibold text-gray-600">수령 방법:</span> {FULFILLMENT_TYPE_LABEL[order.fulfillmentType] || order.fulfillmentType}</p>
                {order.fulfillmentType === "DELIVERY" && (
                  <p><span className="font-semibold text-gray-600">배달주소:</span> {order.deliveryAddress}</p>
                )}
                {order.fulfillmentType === "PICKUP" && (
                  <p><span className="font-semibold text-gray-600">픽업시간:</span> {order.pickupTime || "-"}</p>
                )}
                {order.paymentMethod && (
                  <p><span className="font-semibold text-gray-600">결제방법:</span> {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}</p>
                )}
                {order.outOfStockPolicy && (
                  <p><span className="font-semibold text-gray-600">품절 시 처리:</span> {OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy] || order.outOfStockPolicy}</p>
                )}
                {order.memo && (
                  <p><span className="font-semibold text-gray-600">요청사항:</span> {order.memo}</p>
                )}
              </div>

              <div className="mb-3 space-y-2 text-sm">
                <h3 className="font-semibold text-gray-900">주문상품</h3>
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        {item.barcode || "-"} · {item.quantity}개 · {formatPrice(item.price)}원
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t pt-3 font-black">
                <span>총액</span>
                <span className="text-green-700">{formatPrice(order.totalAmount)}</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
