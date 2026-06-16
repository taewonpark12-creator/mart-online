"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { formatPrice } from "@/lib/types";

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED";

type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryAddress: string;
  pickupTime: string | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "접수 대기",
  PAID: "처리 완료",
  FAILED: "실패",
  CANCELED: "취소",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-700",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId],
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/orders${params}`, { cache: "no-store" });
      const result = await res.json().catch(() => null);
      console.log("ADMIN_ORDERS_STATUS", res.status);
      console.log("ADMIN_ORDERS_RESPONSE", result);

      if (!res.ok) {
        if (res.status === 401) throw new Error("관리자 인증 필요");
        throw new Error(result?.message || result?.error || "주문 조회 오류");
      }

      const nextOrders = Array.isArray(result?.orders) ? result.orders : [];
      setOrders(nextOrders);
      setSelectedOrderId((current) =>
        current && nextOrders.some((order: Order) => order.id === current)
          ? current
          : nextOrders[0]?.id ?? null,
      );
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "주문 조회 오류");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function updateStatus(order: Order, nextStatus: OrderStatus) {
    setUpdating(true);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok) {
        alert(result?.error || "상태 변경에 실패했습니다.");
        return;
      }

      await loadOrders();
    } catch {
      alert("상태 변경에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">주문 관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              DB에 저장된 주문 목록을 확인하고 처리 상태를 변경합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-bold text-green-700"
          >
            새로고침
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatus("")}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              status === "" ? "bg-green-600 text-white" : "border bg-white text-gray-600"
            }`}
          >
            전체
          </button>
          {(["PENDING", "PAID", "FAILED", "CANCELED"] as OrderStatus[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                status === item ? "bg-green-600 text-white" : "border bg-white text-gray-600"
              }`}
            >
              {STATUS_LABEL[item]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-400">
            주문을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center text-red-500">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-gray-400">
            DB에 저장된 주문 없음
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
            <section className="space-y-3">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                    selectedOrder?.id === order.id ? "border-green-500" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-black text-gray-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-800">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-gray-500">{order.customerPhone}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_CLASS[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString("ko-KR")}
                    </p>
                    <p className="font-black text-green-700">
                      {formatPrice(order.totalAmount)}
                    </p>
                  </div>
                </button>
              ))}
            </section>

            {selectedOrder && (
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4">
                  <div>
                    <p className="font-mono text-lg font-black text-gray-900">
                      {selectedOrder.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(selectedOrder.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[selectedOrder.status]}`}>
                    {STATUS_LABEL[selectedOrder.status]}
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl bg-blue-50 p-4">
                    <h2 className="mb-3 text-sm font-black text-blue-900">고객 정보</h2>
                    <div className="space-y-2 text-sm">
                      <p>고객명: {selectedOrder.customerName}</p>
                      <p>전화번호: {selectedOrder.customerPhone}</p>
                      <p>
                        수령:{" "}
                        {selectedOrder.fulfillmentType === "DELIVERY" ? "배달" : "픽업"}
                      </p>
                      {selectedOrder.fulfillmentType === "DELIVERY" ? (
                        <p>주소: {selectedOrder.deliveryAddress}</p>
                      ) : (
                        <p>픽업 시간: {selectedOrder.pickupTime}</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl bg-amber-50 p-4">
                    <h2 className="mb-3 text-sm font-black text-amber-900">처리 상태</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {(["PENDING", "PAID", "FAILED", "CANCELED"] as OrderStatus[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          disabled={updating || selectedOrder.status === item}
                          onClick={() => updateStatus(selectedOrder, item)}
                          className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-40"
                        >
                          {STATUS_LABEL[item]}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="mt-5 rounded-xl bg-gray-50 p-4">
                  <h2 className="mb-3 text-sm font-black text-gray-900">주문 상품</h2>
                  <div className="divide-y">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-gray-800">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatPrice(item.price)} x {item.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-lg font-black">
                    <span>총액</span>
                    <span className="text-green-700">
                      {formatPrice(selectedOrder.totalAmount)}
                    </span>
                  </div>
                </section>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
