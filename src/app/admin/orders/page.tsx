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
  memo?: string | null;
};

function getOrderTime(order: Order) {
  return new Date(order.createdAt).toLocaleString("ko-KR");
}

function getStatusPriority(status: OrderStatus): number {
  const priority: Record<OrderStatus, number> = {
    PENDING: 0,
    APPROVED: 1,
    DELIVERED: 2,
    CANCELLED: 3,
  };
  return priority[status] ?? 999;
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

function OrderSummaryCard({
  order,
  selected,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition ${
        selected
          ? "border-green-500 bg-green-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-green-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{order.customerName}</p>
          <p className="text-xs font-semibold text-gray-700 truncate mt-1">{order.customerPhone}</p>
          <p className="text-xs text-gray-500 truncate mt-1">{FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}</p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs text-gray-500">{getOrderTime(order)}</p>
        <p className="text-base font-black text-green-700">{formatPrice(order.totalAmount)}</p>
      </div>
    </button>
  );
}

function StatusActions({
  order,
  updating,
  onUpdate,
  onCancel,
}: {
  order: Order;
  updating: boolean;
  onUpdate: (status: OrderStatus) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-green-100 bg-green-50 p-4">
        <p className="text-xs font-bold text-green-800 mb-2">상태 변경</p>
        <div className="grid grid-cols-3 gap-2">
          {(["PENDING", "APPROVED", "DELIVERED"] as OrderStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              disabled={updating || order.status === status || order.status === "CANCELLED"}
              onClick={() => onUpdate(status)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                order.status === status
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-40"
              }`}
            >
              {ORDER_STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </div>

      {order.status === "PENDING" && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-800 mb-2">주문 취소</p>
          <button
            type="button"
            disabled={updating}
            onClick={onCancel}
            className="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            주문 취소
          </button>
        </div>
      )}
    </div>
  );
}

function OrderDetailPanel({
  order,
  updating,
  onUpdateStatus,
  onCancel,
}: {
  order: Order | null;
  updating: boolean;
  onUpdateStatus: (status: OrderStatus) => void;
  onCancel: () => void;
}) {
  if (!order) {
    return (
      <aside className="h-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
        <p className="font-semibold">주문을 선택해주세요.</p>
        <p className="mt-2 text-sm">왼쪽 목록에서 주문을 선택하면 상세 처리 패널이 열립니다.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-mono">{order.orderNumber}</p>
            <p className="text-xs text-gray-500 mt-1">{getOrderTime(order)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <p className="text-2xl font-black text-green-700">{formatPrice(order.totalAmount)}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <StatusActions order={order} updating={updating} onUpdate={onUpdateStatus} onCancel={onCancel} />

        <section className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
          <h2 className="text-sm font-bold text-blue-900 mb-3">고객 정보</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-blue-500 font-semibold mr-2">고객</span>{order.customerName}</p>
            <p><span className="text-blue-500 font-semibold mr-2">연락처</span>{order.customerPhone}</p>
            {order.fulfillmentType === "PICKUP" ? (
              <>
                <p><span className="text-blue-500 font-semibold mr-2">픽업</span>{order.pickupTime || "시간 미지정"}</p>
              </>
            ) : (
              <>
                <p><span className="text-blue-500 font-semibold mr-2">주소</span>{order.deliveryAddress}</p>
                {order.deliveryEntrance && (
                  <p><span className="text-blue-500 font-semibold mr-2">출입</span>{order.deliveryEntrance}</p>
                )}
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">주문 상품</h2>
          <div className="divide-y">
            {order.items && order.items.length > 0 ? (
              order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{item.productName || "상품명 없음"}</p>
                    <p className="text-xs text-gray-500">{formatPrice(item.unitPrice || 0)} x {item.quantity || 0}</p>
                  </div>
                  <p className="font-semibold text-gray-900 shrink-0">
                    {formatPrice((item.unitPrice || 0) * (item.quantity || 0))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">주문 상품 정보가 없습니다.</p>
            )}
          </div>
        </section>

        {order.memo && (
          <section className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <h2 className="text-sm font-bold text-amber-900 mb-3">요청사항</h2>
            <p className="text-sm text-gray-700">{order.memo}</p>
          </section>
        )}
      </div>
    </aside>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const selectedOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId) ?? null
    : null;

  const visibleOrders = orders
    .filter((order) => matchesSearch(order, search.trim()))
    .sort((a, b) => {
      const statusPriorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
      if (statusPriorityDiff !== 0) return statusPriorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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

  const fetchPendingCount = async () => {
    try {
      const res = await fetch("/api/admin/orders/pending-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const newPendingCount = data.pendingCount ?? 0;
      setPendingCount(newPendingCount);
      
      if (newPendingCount > previousPendingCount && previousPendingCount > 0) {
        setShowNewOrderAlert(true);
        if (notificationPermission === "granted") {
          showBrowserNotification(newPendingCount);
        }
      }
      setPreviousPendingCount(newPendingCount);
    } catch (error) {
      console.error("[admin/orders] pending-count fetch failed", error);
    }
  };

  const showBrowserNotification = (count: number) => {
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("신규 주문", {
          body: `대기 중인 주문이 ${count}건 있습니다.`,
          icon: "/favicon.ico",
        });
      }
    } catch (error) {
      console.error("[admin/orders] browser notification failed", error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
    } catch (error) {
      console.error("[admin/orders] notification permission request failed", error);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(interval);
  }, [previousPendingCount, notificationPermission]);

  async function updateStatus(status: OrderStatus) {
    if (!selectedOrderId) return;
    setUpdatingOrderId(selectedOrderId);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrderId}`, {
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
        current.map((order) => (order.id === selectedOrderId ? { ...order, status } : order))
      );
    } catch (error) {
      console.error("[admin/orders] status update failed", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function cancelOrder() {
    if (!selectedOrderId) return;
    if (!confirm("정말 이 주문을 취소하시겠습니까?")) return;
    setUpdatingOrderId(selectedOrderId);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "주문 취소에 실패했습니다.");
        return;
      }

      setOrders((current) =>
        current.map((order) => (order.id === selectedOrderId ? { ...order, status: "CANCELLED" } : order))
      );
    } catch (error) {
      console.error("[admin/orders] cancel failed", error);
      alert("주문 취소 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {showNewOrderAlert && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-semibold text-red-800">신규 주문이 도착했습니다.</p>
            </div>
            <button
              onClick={() => {
                setShowNewOrderAlert(false);
                fetchOrders();
              }}
              className="text-sm text-red-700 hover:text-red-900 font-medium"
            >
              확인
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
            <p className="text-sm text-gray-500 mt-1">주문 목록을 조회하고 상태를 변경합니다.</p>
          </div>
          {notificationPermission === "default" && (
            <button
              onClick={requestNotificationPermission}
              className="text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              알림 허용
            </button>
          )}
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
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
            <div className="flex-1 space-y-3">
              {visibleOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-dashed border-gray-300">
                  주문 내역이 없습니다.
                </div>
              ) : (
                visibleOrders.map((order) => (
                  <OrderSummaryCard
                    key={order.id}
                    order={order}
                    selected={selectedOrderId === order.id}
                    onSelect={() => setSelectedOrderId(order.id)}
                  />
                ))
              )}
            </div>

            <div className="w-full lg:w-[450px]">
              <OrderDetailPanel
                order={selectedOrder}
                updating={updatingOrderId === selectedOrderId}
                onUpdateStatus={updateStatus}
                onCancel={cancelOrder}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
