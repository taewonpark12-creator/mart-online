"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  FULFILLMENT_TYPE_LABEL,
  formatPrice,
  type OrderStatus,
  type FulfillmentType,
} from "@/lib/types";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  productId: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  deliveryEntrance: string | null;
  pickupTime: string | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items?: OrderItem[];
};

function getOrderTime(order: Order) {
  return new Date(order.createdAt).toLocaleString("ko-KR");
}

function matchesSearch(order: Order, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const searchFields = [
    order.orderNumber,
    order.customerName,
    order.customerPhone,
    order.deliveryAddress,
    (order.items || []).map((item) => item.productName).join(" "),
  ].join(" ").toLowerCase();
  return searchFields.includes(normalized);
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const selectedOrder = selectedOrderId 
    ? orders.find((order) => order.id === selectedOrderId) ?? null
    : null;

  const visibleOrders = orders.filter((order) => matchesSearch(order, search.trim()));

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/admin/orders${params}`, { cache: "no-store" });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        throw new Error("주문 데이터를 불러오지 못했습니다.");
      }

      const data = await res.json();
      setOrders(data);
      if (!selectedOrderId && data[0]) {
        setSelectedOrderId(data[0].id);
      }
    } catch (error) {
      console.error("[admin/orders] load failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "상태 변경에 실패했습니다.");
        return;
      }

      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status } : order))
      );
    } catch (error) {
      console.error("[admin/orders] status update failed", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
            <p className="text-sm text-gray-500 mt-1">주문 목록을 조회하고 상태를 변경합니다.</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="text-sm text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-50"
          >
            새로고침
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !filter ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              전체
            </button>
            {(["PENDING", "APPROVED", "DELIVERED", "CANCELLED"] as OrderStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  filter === status ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
                }`}
              >
                {ORDER_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="주문번호, 고객명, 연락처, 주소 검색"
            className="w-full lg:w-80 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {loading && orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            로딩 중...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-dashed border-gray-300">
            주문 내역이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">주문번호</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">고객명</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">연락처</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">주소</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">총액</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">주문시간</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm">{order.customerName}</td>
                    <td className="px-4 py-3 text-sm">{order.customerPhone}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">{order.deliveryAddress}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatPrice(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{getOrderTime(order)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setShowDetail(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          상세
                        </button>
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                          disabled={updatingOrderId === order.id}
                          className="text-xs border rounded px-2 py-1 disabled:opacity-50"
                        >
                          {(["PENDING", "APPROVED", "DELIVERED", "CANCELLED"] as OrderStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showDetail && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="border-b p-5 flex items-center justify-between">
                <h2 className="text-lg font-bold">주문 상세</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  닫기
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">주문번호</p>
                    <p className="font-mono font-medium">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">상태</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${ORDER_STATUS_COLOR[selectedOrder.status]}`}>
                      {ORDER_STATUS_LABEL[selectedOrder.status]}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">고객명</p>
                    <p>{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">연락처</p>
                    <p>{selectedOrder.customerPhone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">주소</p>
                    <p>{selectedOrder.deliveryAddress}</p>
                    {selectedOrder.deliveryEntrance && (
                      <p className="text-xs text-gray-400 mt-1">출입: {selectedOrder.deliveryEntrance}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">수령방법</p>
                    <p>{FULFILLMENT_TYPE_LABEL[selectedOrder.fulfillmentType]}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">픽업시간</p>
                    <p>{selectedOrder.pickupTime || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">주문시간</p>
                    <p>{getOrderTime(selectedOrder)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">총액</p>
                    <p className="font-bold text-green-700">{formatPrice(selectedOrder.totalAmount)}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold text-sm mb-3">주문 상품</h3>
                  <div className="space-y-2">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b">
                          <div className="flex-1">
                            <p className="font-medium">{item.productName || "상품명 없음"}</p>
                            <p className="text-xs text-gray-500">
                              {formatPrice(item.unitPrice || 0)} x {item.quantity || 0}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {formatPrice((item.unitPrice || 0) * (item.quantity || 0))}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">주문 상품 정보가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
