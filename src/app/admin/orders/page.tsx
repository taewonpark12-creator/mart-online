"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  FULFILLMENT_TYPE_LABEL,
  formatPrice,
  type OrderStatus,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/types";

const OUT_OF_STOCK_POLICY_LABEL: Record<string, string> = {
  SUBSTITUTE: "대체상품으로 받기",
  CANCEL_ONLY: "품절된 상품만 취소",
  CONTACT: "연락바람",
};
import { getKoreaTodayString, getKoreaYesterdayString, getKoreaMonthStartString, getKoreaDaysAgoString } from "@/lib/korea-date";
import { printReceiptNow } from "@/lib/print-receipt";
import type { ReceiptOrder } from "@/lib/receipt-html";

const ORDERS_AUTO_REFRESH_MS = 12000;

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  productId: string | null;
  product?: { name: string; barcode?: string | null } | null;
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
  paymentMethod: PaymentMethod | null;
  outOfStockPolicy?: string | null;
};

function getOrderTime(order: Order) {
  return new Date(order.createdAt).toLocaleString("ko-KR");
}

function getElapsedTime(createdAt: string): { text: string; minutes: number } {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return { text: "방금 접수", minutes: diffMinutes };
  }

  if (diffMinutes < 60) {
    return { text: `접수 후 ${diffMinutes}분`, minutes: diffMinutes };
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (minutes === 0) {
    return { text: `접수 후 ${hours}시간`, minutes: diffMinutes };
  }
  return { text: `접수 후 ${hours}시간 ${minutes}분`, minutes: diffMinutes };
}

function toReceiptOrder(order: Order): ReceiptOrder {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: order.deliveryAddress,
    deliveryEntrance: order.deliveryEntrance,
    pickupTime: order.pickupTime,
    paymentMethod: order.paymentMethod,
    memo: order.memo || null,
    outOfStockPolicy: order.outOfStockPolicy || null,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
    items: (order.items || []).map((item) => ({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      productName: item.productName,
      product: item.product || undefined,
    })),
  };
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
  const isPending = order.status === "PENDING";
  const elapsedTime = isPending ? getElapsedTime(order.createdAt) : null;
  const isDelayed = elapsedTime && elapsedTime.minutes >= 30;
  const isWarning = elapsedTime && elapsedTime.minutes >= 20 && elapsedTime.minutes < 30;

  let cardClass = "border-gray-200 bg-white hover:border-green-200 hover:shadow-sm";
  if (isDelayed) {
    cardClass = "border-red-300 bg-red-50 hover:border-red-400 hover:shadow-sm";
  } else if (isWarning) {
    cardClass = "border-orange-300 bg-orange-50 hover:border-orange-400 hover:shadow-sm";
  }

  if (selected) {
    cardClass = "border-green-500 bg-green-50 shadow-sm";
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{order.customerName}</p>
          <p className="text-xs font-semibold text-gray-700 truncate mt-1">{order.customerPhone}</p>
          <p className="text-xs text-gray-500 truncate mt-1">{FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDelayed && <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-red-600 text-white">⚠️ 지연</span>}
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {elapsedTime && <p className="text-xs font-semibold text-gray-600">{elapsedTime.text}</p>}
          <p className="text-xs text-gray-500">{getOrderTime(order)}</p>
        </div>
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
  onDelete,
  onClose,
}: {
  order: Order | null;
  updating: boolean;
  onUpdateStatus: (status: OrderStatus) => void;
  onCancel: () => void;
  onDelete: () => void;
  onClose?: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintReceipt = () => {
    if (!order) return;
    setIsPrinting(true);
    try {
      const printableOrder = toReceiptOrder(order);
      printReceiptNow(printableOrder);
      setTimeout(() => setIsPrinting(false), 3000);
    } catch (error) {
      console.error("[admin/orders] print receipt failed", error);
      alert("인쇄를 시작할 수 없습니다. 다시 시도해주세요.");
      setIsPrinting(false);
    }
  };

  const handleDelete = () => {
    if (!order) return;
    if (confirm("정말 이 주문을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.")) {
      onDelete();
    }
  };

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
            {order.status === "PENDING" && (
              <p className="text-xs font-semibold text-gray-600 mt-1">{getElapsedTime(order.createdAt).text}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{getOrderTime(order)}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <p className="text-2xl font-black text-green-700">{formatPrice(order.totalAmount)}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <button
          type="button"
          onClick={handlePrintReceipt}
          disabled={isPrinting}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPrinting ? "인쇄 준비 중..." : "영수증 인쇄"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={updating}
          className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          주문 삭제
        </button>

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
            {order.outOfStockPolicy && (
              <p><span className="text-blue-500 font-semibold mr-2">품절 시 처리</span>{OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy] || order.outOfStockPolicy}</p>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">주문 상품</h2>
          <div className="divide-y">
            {order.items && order.items.length > 0 ? (
              order.items.map((item) => {
                const barcode = item.product?.barcode || "";
                return (
                  <div key={item.id} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{item.productName || "상품명 없음"}</p>
                      {barcode && <p className="text-xs text-gray-500">바코드: {barcode}</p>}
                      <p className="text-xs text-gray-500">{formatPrice(item.unitPrice || 0)} x {item.quantity || 0}</p>
                    </div>
                    <p className="font-semibold text-gray-900 shrink-0">
                      {formatPrice((item.unitPrice || 0) * (item.quantity || 0))}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">주문 상품 정보가 없습니다.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-amber-50 border border-amber-100 p-4">
          <h2 className="text-sm font-bold text-amber-900 mb-3">요청사항</h2>
          <p className="text-sm text-gray-700">{order.memo || "요청사항 없음"}</p>
        </section>
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
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [todaySummary, setTodaySummary] = useState<{
    total: number;
    pending: number;
    approved: number;
    delivered: number;
    cancelled: number;
  } | null>(null);
  const [dateFilter, setDateFilter] = useState<{
    type: "all" | "today" | "yesterday" | "last7days" | "thismonth" | "custom";
    startDate: string | null;
    endDate: string | null;
  }>({ type: "all", startDate: null, endDate: null });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(false);

  const handleDateFilterChange = (type: "all" | "today" | "yesterday" | "last7days" | "thismonth" | "custom", startDate?: string, endDate?: string) => {
    let newStartDate: string | null = null;
    let newEndDate: string | null = null;

    switch (type) {
      case "today":
        newStartDate = getKoreaTodayString();
        newEndDate = getKoreaTodayString();
        break;
      case "yesterday":
        newStartDate = getKoreaYesterdayString();
        newEndDate = getKoreaYesterdayString();
        break;
      case "last7days":
        newStartDate = getKoreaDaysAgoString(6);
        newEndDate = getKoreaTodayString();
        break;
      case "thismonth":
        newStartDate = getKoreaMonthStartString();
        newEndDate = getKoreaTodayString();
        break;
      case "custom":
        newStartDate = startDate || null;
        newEndDate = endDate || null;
        break;
      case "all":
        newStartDate = null;
        newEndDate = null;
        break;
    }

    setDateFilter({ type, startDate: newStartDate, endDate: newEndDate });
  };

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

  const fetchOrders = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);
      if (dateFilter.startDate) params.append("startDate", dateFilter.startDate);
      if (dateFilter.endDate) params.append("endDate", dateFilter.endDate);
      const queryString = params.toString();
      const res = await fetch(`/api/admin/orders${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        throw new Error("주문 데이터를 불러오지 못했습니다.");
      }

      const data: Order[] = await res.json();
      setOrders(data);
      setSelectedOrderId((currentSelectedId) => {
        if (currentSelectedId && data.some((order) => order.id === currentSelectedId)) {
          return currentSelectedId;
        }
        return data[0]?.id ?? null;
      });
    } catch (error) {
      console.error("[admin/orders] load failed", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [dateFilter.endDate, dateFilter.startDate, filter, router]);

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

  const fetchTodaySummary = async () => {
    try {
      const res = await fetch("/api/admin/orders/today-summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTodaySummary(data);
    } catch (error) {
      console.error("[admin/orders] today-summary fetch failed", error);
    }
  };

  const showBrowserNotification = (count: number) => {
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("한사랑마트 신규 주문", {
          body: `대기 중인 주문이 ${count}건 있습니다.`,
          tag: "new-order-notification",
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
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders({ silent: true });
    }, ORDERS_AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationSupported(true);
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    fetchTodaySummary();
    const interval = setInterval(fetchTodaySummary, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(interval);
  }, [previousPendingCount, notificationPermission]);

  useEffect(() => {
    if (!soundEnabled) return;

    const audio = new Audio("/sounds/new-order.mp3");
    let soundInterval: NodeJS.Timeout | null = null;

    const playSound = () => {
      if (pendingCount > 0) {
        audio.currentTime = 0;
        audio.play().catch((err) => console.error("Sound play failed:", err));
      }
    };

    if (pendingCount > 0) {
      playSound();
      soundInterval = setInterval(playSound, 15000);
    }

    return () => {
      if (soundInterval) clearInterval(soundInterval);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [soundEnabled, pendingCount]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
      fetchTodaySummary();
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
      fetchTodaySummary();
    } catch (error) {
      console.error("[admin/orders] cancel failed", error);
      alert("주문 취소 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function deleteOrder() {
    if (!selectedOrderId) return;
    setUpdatingOrderId(selectedOrderId);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "주문 삭제에 실패했습니다.");
        return;
      }

      // Remove the deleted order from the list
      setOrders((current) => current.filter((order) => order.id !== selectedOrderId));
      setSelectedOrderId(null);
      fetchTodaySummary();
      fetchPendingCount();
    } catch (error) {
      console.error("[admin/orders] delete failed", error);
      alert("주문 삭제 중 오류가 발생했습니다.");
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
                fetchTodaySummary();
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
          <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm sm:items-end">
            {soundEnabled ? (
              <button
                type="button"
                onClick={() => setSoundEnabled(false)}
                className="rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700"
              >
                🔔 신규주문 알림 켜짐
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSoundEnabled(true)}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              >
                🔕 신규주문 알림 꺼짐
              </button>
            )}

            {!notificationSupported ? (
              <span className="text-xs font-medium text-gray-500">이 브라우저는 알림 권한 안내를 지원하지 않습니다.</span>
            ) : notificationPermission === "default" ? (
              <div className="flex flex-col gap-1 text-xs text-amber-900 sm:items-end">
                <span className="font-medium">브라우저 알림 권한도 켜면 화면 밖에서도 신규주문을 확인할 수 있습니다.</span>
                <button
                  onClick={requestNotificationPermission}
                  className="self-start rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100 sm:self-end"
                >
                  브라우저 알림 허용
                </button>
              </div>
            ) : notificationPermission === "granted" ? (
              <span className="text-xs font-medium text-green-700">브라우저 신규주문 알림 허용됨</span>
            ) : (
              <div className="max-w-md text-xs font-semibold text-red-700 sm:text-right">
                브라우저 알림이 차단되어 있습니다. 주소창 왼쪽 설정에서 허용해주세요.
              </div>
            )}
          </div>
        </div>

        {todaySummary && (
          <div className="mb-6 rounded-xl bg-white border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">오늘 주문 요약</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">전체</p>
                <p className="text-lg font-bold text-gray-900">{todaySummary.total}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">신규주문</p>
                <p className="text-lg font-bold text-amber-800">{todaySummary.pending}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">확인완료</p>
                <p className="text-lg font-bold text-blue-800">{todaySummary.approved}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">배송완료</p>
                <p className="text-lg font-bold text-green-800">{todaySummary.delivered}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">취소됨</p>
                <p className="text-lg font-bold text-red-800">{todaySummary.cancelled}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-xl bg-white border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">날짜 필터</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDateFilterChange("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateFilter.type === "all" ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => handleDateFilterChange("today")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateFilter.type === "today" ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => handleDateFilterChange("yesterday")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateFilter.type === "yesterday" ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              어제
            </button>
            <button
              onClick={() => handleDateFilterChange("last7days")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateFilter.type === "last7days" ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              최근 7일
            </button>
            <button
              onClick={() => handleDateFilterChange("thismonth")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateFilter.type === "thismonth" ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"
              }`}
            >
              이번 달
            </button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter.startDate || ""}
                onChange={(e) => handleDateFilterChange("custom", e.target.value, dateFilter.endDate || undefined)}
                className="px-3 py-1.5 rounded-lg border text-sm focus:ring-2 focus:ring-green-400 outline-none"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={dateFilter.endDate || ""}
                onChange={(e) => handleDateFilterChange("custom", dateFilter.startDate || undefined, e.target.value)}
                className="px-3 py-1.5 rounded-lg border text-sm focus:ring-2 focus:ring-green-400 outline-none"
              />
            </div>
          </div>
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
                  <div key={order.id}>
                    <OrderSummaryCard
                      order={order}
                      selected={selectedOrderId === order.id}
                      onSelect={() => setSelectedOrderId(order.id)}
                    />
                    {selectedOrderId === order.id && (
                      <div className="lg:hidden mt-3">
                        <OrderDetailPanel
                          order={selectedOrder}
                          updating={updatingOrderId === selectedOrderId}
                          onUpdateStatus={updateStatus}
                          onCancel={cancelOrder}
                          onDelete={deleteOrder}
                          onClose={() => setSelectedOrderId(null)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="hidden lg:block w-full lg:w-[450px]">
              <div className="sticky top-6">
                <OrderDetailPanel
                  order={selectedOrder}
                  updating={updatingOrderId === selectedOrderId}
                  onUpdateStatus={updateStatus}
                  onCancel={cancelOrder}
                  onDelete={deleteOrder}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
