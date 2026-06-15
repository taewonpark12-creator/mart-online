"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ORDER_STATUS_FILTER,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  FULFILLMENT_TYPE_LABEL,
  formatPaymentMethodLabel,
  formatPickupTimeLabel,
  OUT_OF_STOCK_POLICY_LABEL,
  BANK_ACCOUNT,
  formatPrice,
  type OrderStatus,
  type PaymentMethod,
  type FulfillmentType,
  type OutOfStockPolicy,
} from "@/lib/types";
import { STORE } from "@/lib/store";
import { printReceiptNow } from "@/lib/print-receipt";
import { orderItemName } from "@/lib/order-item";
import { useOrderNotification } from "@/lib/notification";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  productName: string;
  product?: { name: string; barcode?: string | null; imageUrl?: string | null; price?: string | number } | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  deliveryEntrance?: string | null;
  pickupTime?: string | null;
  paymentMethod: PaymentMethod | null;
  outOfStockPolicy: OutOfStockPolicy;
  memo: string | null;
  status: OrderStatus;
  totalAmount: string | number;
  createdAt: string;
  items: OrderItem[];
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "APPROVED",
  APPROVED: "DELIVERED",
};

const APPROVED_CANCEL_BLOCK_MESSAGE = "이미 승인된 주문은 취소할 수 없습니다.";

function statusRank(status: OrderStatus) {
  if (status === "PENDING") return 0;
  if (status === "APPROVED") return 1;
  if (status === "DELIVERED") return 2;
  return 3;
}

function getOrderTotal(order: Order) {
  return Number(order.totalAmount) || 0;
}

function getOrderTime(order: Order) {
  return new Date(order.createdAt).toLocaleString("ko-KR");
}

function canCancelOrder(order: Order) {
  return order.status === "PENDING";
}

function countPendingOrders(orders: Order[]) {
  return orders.filter((order) => order.status === "PENDING").length;
}

function matchesSearch(order: Order, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return [
    order.orderNumber,
    order.customerName,
    order.customerPhone,
    order.deliveryAddress,
    order.items.map((item) => orderItemName(item)).join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function OrderSummaryCard({
  order,
  selected,
  fresh,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  fresh: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition ${
        selected
          ? "border-green-500 bg-green-50 shadow-sm"
          : fresh
            ? "border-red-200 bg-red-50/80 animate-pulse"
            : "border-gray-200 bg-white hover:border-green-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {fresh && <span className="h-2 w-2 rounded-full bg-red-500" />}
            <p className="font-mono text-sm font-black text-gray-900 truncate">{order.orderNumber}</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-800 truncate">
            {order.customerName}
          </p>
          <p className="text-xs text-gray-500 truncate">{order.customerPhone}</p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-xs text-gray-500">
          <p>{getOrderTime(order)}</p>
          <p>
            {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
            {order.fulfillmentType === "PICKUP" && order.pickupTime
              ? ` · ${formatPickupTimeLabel(order.pickupTime)}`
              : ""}
          </p>
        </div>
        <p className="text-base font-black text-green-700">{formatPrice(getOrderTotal(order))}</p>
      </div>
    </button>
  );
}

function StatusActions({
  order,
  updating,
  onUpdate,
}: {
  order: Order;
  updating: boolean;
  onUpdate: (status: OrderStatus) => void;
}) {
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-green-100 bg-green-50 p-4">
        <p className="text-xs font-bold text-green-800 mb-2">다음 처리 단계</p>
        {nextStatus ? (
          <button
            type="button"
            disabled={updating}
            onClick={() => onUpdate(nextStatus)}
            className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {updating ? "처리 중..." : `${ORDER_STATUS_LABEL[nextStatus]} 처리`}
          </button>
        ) : (
          <p className="text-sm text-gray-600">다음 처리 단계가 없습니다.</p>
        )}
      </div>

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
  );
}

function OrderDetailPanel({
  order,
  updating,
  onUpdateStatus,
  onCancel,
  onClose,
}: {
  order: Order | null;
  updating: boolean;
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
  onCancel: (order: Order) => void;
  onClose: () => void;
}) {
  if (!order) {
    return (
      <aside className="h-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
        <p className="font-semibold">주문을 선택해주세요.</p>
        <p className="mt-2 text-sm">왼쪽 목록에서 주문을 선택하면 상세 처리 패널이 열립니다.</p>
      </aside>
    );
  }

  const printableOrder = {
    ...order,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  };

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-black text-gray-900">{order.orderNumber}</p>
            <p className="text-xs text-gray-500 mt-1">{getOrderTime(order)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">
            닫기
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            canCancelOrder(order)
              ? "bg-emerald-100 text-emerald-800"
              : "bg-gray-100 text-gray-600"
          }`}>
            {canCancelOrder(order) ? "취소 가능" : "확정 주문(취소 불가)"}
          </span>
          <p className="text-2xl font-black text-green-700">{formatPrice(getOrderTotal(order))}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <StatusActions order={order} updating={updating} onUpdate={(status) => onUpdateStatus(order, status)} />

        <section className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
          <h2 className="text-sm font-bold text-blue-900 mb-3">고객 정보</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-blue-500 font-semibold mr-2">고객</span>{order.customerName}</p>
            <p><span className="text-blue-500 font-semibold mr-2">연락처</span>{order.customerPhone}</p>
            {order.fulfillmentType === "PICKUP" ? (
              <>
                <p><span className="text-blue-500 font-semibold mr-2">픽업</span>{order.pickupTime ? formatPickupTimeLabel(order.pickupTime) : "시간 미지정"}</p>
                <p className="text-xs text-gray-600">{STORE.name} · {STORE.address}</p>
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
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{orderItemName(item)}</p>
                  <p className="text-xs text-gray-500">{formatPrice(Number(item.unitPrice))} x {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-900 shrink-0">
                  {formatPrice(Number(item.unitPrice) * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-amber-50 border border-amber-100 p-4">
          <h2 className="text-sm font-bold text-amber-900 mb-3">결제 및 요청사항</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-amber-600 font-semibold mr-2">수령</span>
              {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
            </p>
            <p>
              <span className="text-amber-600 font-semibold mr-2">결제</span>
              {formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}
            </p>
            {order.paymentMethod === "BANK_TRANSFER" && (
              <p className="text-xs text-amber-800">입금 계좌: {BANK_ACCOUNT.display}</p>
            )}
            <p>
              <span className="text-amber-600 font-semibold mr-2">품절</span>
              {OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy]}
            </p>
            {order.memo && (
              <p>
                <span className="text-amber-600 font-semibold mr-2">요청</span>
                <span className="italic">"{order.memo}"</span>
              </p>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => printReceiptNow(printableOrder)}
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-black"
          >
            영수증 출력
          </button>
          <button
            type="button"
            disabled={updating || order.status === "DELIVERED" || order.status === "CANCELLED"}
            onClick={() => onUpdateStatus(order, "DELIVERED")}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            처리 완료
          </button>
        </div>

        {canCancelOrder(order) ? (
          <section className="rounded-xl border border-red-100 bg-red-50 p-4">
            <h2 className="text-sm font-bold text-red-800 mb-2">취소 처리</h2>
            <button
              type="button"
              disabled={updating}
              onClick={() => onCancel(order)}
              className="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              주문 취소
            </button>
          </section>
        ) : (
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-1">취소 불가 주문</h2>
            <p className="text-xs text-gray-500">승인된 주문은 취소할 수 없습니다.</p>
          </section>
        )}
      </div>
    </aside>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [freshOrderIds, setFreshOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationInterval, setNotificationInterval] = useState(3000);
  const router = useRouter();
  const pathname = usePathname();
  const isMounted = useRef(true);
  const isFetching = useRef(false);
  const previousPendingCount = useRef(0);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const {
    isPlaying,
    stopNotification,
    updatePendingCount,
    setNotificationConfig,
  } = useOrderNotification();

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId],
  );

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => matchesSearch(order, search.trim()));
  }, [orders, search]);

  const pendingOrderCount = useMemo(
    () => countPendingOrders(orders),
    [orders],
  );

  const fetchOrders = useCallback(
    async ({ silent = false, focusNewest = false }: { silent?: boolean; focusNewest?: boolean } = {}) => {
      if (isFetching.current) return;
      isFetching.current = true;
      if (!silent) setLoading(true);

      try {
        const params = filter ? `?status=${filter}` : "";
        const res = await fetch(`/api/admin/orders${params}`, { cache: "no-store" });

        if (!res.ok) {
          if (res.status === 401) {
            console.log("[ADMIN REDIRECT]", {
              source: "/admin/orders",
              target: "/admin",
              reason: "orders_api_unauthorized",
              pathname,
              isAuthenticated: false,
              status: res.status,
              timestamp: Date.now(),
            });
            console.log("[REDIRECT EXECUTE]", {
              from: pathname,
              to: "/admin",
              timestamp: Date.now(),
            });
            router.replace("/admin");
            return;
          }
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "주문 데이터를 불러오지 못했습니다.");
        }

        const data = (await res.json()) as Order[];
        if (!isMounted.current) return;

        const incomingIds = new Set(data.map((order) => order.id));
        const newIds = data.filter((order) => !knownOrderIds.current.has(order.id)).map((order) => order.id);
        knownOrderIds.current = incomingIds;

        if (newIds.length > 0 && knownOrderIds.current.size > newIds.length) {
          setFreshOrderIds(new Set(newIds));
          window.setTimeout(() => setFreshOrderIds(new Set()), 7000);
        }

        const currentPendingCount = countPendingOrders(data);
        const hasNewPending =
          currentPendingCount > previousPendingCount.current && currentPendingCount > 0;

        updatePendingCount(currentPendingCount);

        if (hasNewPending) {
          if (Notification.permission === "granted" && !document.hidden) {
            new Notification("새 주문 접수", {
              body: `${currentPendingCount}개의 대기 주문이 있습니다.`,
              icon: "/icon.png",
              tag: "order-notification",
            });
          }
        }

        document.title =
          currentPendingCount > 0
            ? `(${currentPendingCount}) 주문 관리 - mart-online`
            : "주문 관리 - mart-online";
        previousPendingCount.current = currentPendingCount;

        setOrders(data);
        if (focusNewest && data[0]) {
          setSelectedOrderId(data[0].id);
        } else if (!selectedOrderId && data[0]) {
          setSelectedOrderId(data[0].id);
        } else if (selectedOrderId && !incomingIds.has(selectedOrderId)) {
          setSelectedOrderId(data[0]?.id ?? null);
        }
      } catch (error) {
        console.error("[admin/orders] load failed", error);
      } finally {
        if (isMounted.current) setLoading(false);
        isFetching.current = false;
      }
    },
    [filter, pathname, router, selectedOrderId, updatePendingCount],
  );

  useEffect(() => {
    isMounted.current = true;
    fetchOrders();

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      isMounted.current = false;
      document.title = "mart-online";
    };
  }, [fetchOrders]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const pollOrders = () => {
      fetchOrders({ silent: true, focusNewest: true });
    };

    const startPolling = () => {
      if (interval) clearInterval(interval);
      pollOrders();
      interval = setInterval(pollOrders, 12000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchOrders, updatePendingCount]);

  async function updateStatus(order: Order, status: OrderStatus) {
    if (order.status === status || order.status === "CANCELLED") return;
    if (status === "CANCELLED" && !canCancelOrder(order)) {
      alert(APPROVED_CANCEL_BLOCK_MESSAGE);
      return;
    }
    setUpdatingOrderId(order.id);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error ?? "상태 변경에 실패했습니다.");
        return;
      }

      setOrders((current) => {
        const updatedOrders = current.map((item) => (item.id === order.id ? { ...item, status } : item));
        const filteredOrders = filter && filter !== status
          ? updatedOrders.filter((item) => item.id !== order.id)
          : updatedOrders;

        if (selectedOrderId === order.id && filter && filter !== status) {
          setSelectedOrderId(filteredOrders[0]?.id ?? null);
        }

        return filteredOrders;
      });
      if (status === "APPROVED" || status === "CANCELLED") {
        stopNotification();
      }
    } catch (error) {
      console.error("[admin/orders] status update failed", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function cancelOrder(order: Order) {
    if (!canCancelOrder(order)) {
      alert(APPROVED_CANCEL_BLOCK_MESSAGE);
      return;
    }
    if (!confirm(`주문 ${order.orderNumber}을 취소하시겠습니까?`)) return;
    updateStatus(order, "CANCELLED");
  }

  function advanceSelectedOrder() {
    if (!selectedOrder) return;
    const next = NEXT_STATUS[selectedOrder.status];
    if (next) updateStatus(selectedOrder, next);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Enter") {
        event.preventDefault();
        advanceSelectedOrder();
      }
      if (event.key === "Escape") {
        setSelectedOrderId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleNotificationConfigChange = () => {
    setNotificationConfig({ interval: notificationInterval });
    setShowNotificationSettings(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">주문 운영 콘솔</h1>
              <p className="text-sm text-gray-500 mt-1">실시간 주문을 선택하고 오른쪽 패널에서 빠르게 처리합니다.</p>
            </div>
            {pendingOrderCount > 0 && (
              <div className={`relative inline-flex items-center ${isPlaying ? "animate-pulse" : ""}`}>
                <span className="absolute flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="ml-4 bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  대기 {pendingOrderCount}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowNotificationSettings((value) => !value)}
              className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              알림 설정
            </button>
            <button
              type="button"
              onClick={() => fetchOrders({ focusNewest: false })}
              className="text-sm text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {showNotificationSettings && (
          <div className="bg-white rounded-2xl border p-4 mb-6">
            <h3 className="font-semibold mb-3">알림 설정</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm text-gray-600">반복 간격(초)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={notificationInterval / 1000}
                onChange={(e) => setNotificationInterval(Number(e.target.value) * 1000)}
                className="px-3 py-1.5 border rounded-lg w-20"
              />
              <button type="button" onClick={handleNotificationConfigChange} className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 text-sm">
                적용
              </button>
              <button type="button" onClick={() => stopNotification()} className="bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 text-sm">
                알림 중지
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilter("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!filter ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
            >
              전체
            </button>
            {ORDER_STATUS_FILTER.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === status ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
              >
                {ORDER_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="주문번호, 고객명, 연락처, 상품 검색"
            className="w-full lg:w-80 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <section className="space-y-3">
            {loading && orders.length === 0 ? (
              [1, 2, 3].map((index) => (
                <div key={index} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
              ))
            ) : visibleOrders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
                주문 내역이 없습니다.
              </div>
            ) : (
              visibleOrders
                .slice()
                .sort((a, b) => statusRank(a.status) - statusRank(b.status))
                .map((order) => (
                  <OrderSummaryCard
                    key={order.id}
                    order={order}
                    selected={selectedOrder?.id === order.id}
                    fresh={freshOrderIds.has(order.id)}
                    onSelect={() => {
                      setSelectedOrderId(order.id);
                      setFreshOrderIds((current) => {
                        const next = new Set(current);
                        next.delete(order.id);
                        return next;
                      });
                    }}
                  />
                ))
            )}
          </section>

          <OrderDetailPanel
            order={selectedOrder}
            updating={Boolean(updatingOrderId && selectedOrder?.id === updatingOrderId)}
            onUpdateStatus={updateStatus}
            onCancel={cancelOrder}
            onClose={() => setSelectedOrderId(null)}
          />
        </div>
      </div>
    </div>
  );
}
