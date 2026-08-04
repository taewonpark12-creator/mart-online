"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  FULFILLMENT_TYPE_LABEL,
  formatPaymentMethodLabel,
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
import { sortOrderItemsByProductCategory } from "@/lib/order-item-category-sort";

// Keep order-list fetching separate from notification checks and sound repeat timers.
const ORDER_LIST_AUTO_REFRESH_MS = 5 * 60 * 1000;
const ORDER_NOTIFICATION_VISIBLE_POLL_MS = 15000;
const ORDER_NOTIFICATION_HIDDEN_POLL_MS = 60000;
const TODAY_SUMMARY_REFRESH_MS = 60000;
const ORDER_NOTIFICATION_ENABLED_STORAGE_KEY = "adminOrderNotificationEnabled";
const ORDER_NOTIFICATION_SESSION_ENABLED_STORAGE_KEY = "adminOrderNotificationSessionEnabled";
const ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY = "adminOrderNotificationKnownPendingIds";
const ORDER_NOTIFICATION_REPEAT_MS = 10000;

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  productId: string | null;
  itemStatus?: "ACTIVE" | "CANCELLED" | string | null;
  product?: { name: string; barcode?: string | null; category?: string | null } | null;
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
  const activeTotalAmount = (order.items || []).reduce((sum, item) => {
    if (item.itemStatus === "CANCELLED") return sum;
    return sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0);
  }, 0);

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
    totalAmount: activeTotalAmount,
    createdAt: order.createdAt,
    items: sortOrderItemsByProductCategory(order.items || []).map((item) => ({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      productName: item.productName,
      itemStatus: item.itemStatus === "CANCELLED" ? "CANCELLED" : "ACTIVE",
      product: item.product || undefined,
    })),
  };
}

function hasCancelledItems(order: Order) {
  return Boolean(order.items?.some((item) => item.itemStatus === "CANCELLED"));
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
          {hasCancelledItems(order) && (
            <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
              일부 품절취소
            </span>
          )}
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

      {order.status !== "CANCELLED" && (
        <div className="rounded-xl border border-red-100 bg-white p-3">
          <div className="mb-2">
            <p className="text-xs font-bold text-red-800">주문 전체 취소</p>
            <p className="mt-1 text-[11px] text-gray-500">주문 기록은 남기고 매출 합계에서 제외합니다.</p>
          </div>
          <button
            type="button"
            disabled={updating}
            onClick={onCancel}
            className="inline-flex rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            주문 전체 취소
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
  onCancelItem,
  onDelete,
  onClose,
}: {
  order: Order | null;
  updating: boolean;
  onUpdateStatus: (status: OrderStatus) => void;
  onCancel: () => void;
  onCancelItem: (item: OrderItem) => void;
  onDelete: () => void;
  onClose?: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDangerActions, setShowDangerActions] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const canDeleteOrder = order?.status === "PENDING" || order?.status === "CANCELLED";

  useEffect(() => {
    setShowDangerActions(false);
    setDeleteConfirmText("");
  }, [order?.id]);

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
    if (!canDeleteOrder) {
      alert("주문삭제는 신규주문 또는 취소된 주문만 가능합니다.");
      return;
    }
    if (deleteConfirmText.trim() !== "주문삭제") {
      alert('"주문삭제"를 정확히 입력해야 삭제할 수 있습니다.');
      return;
    }
    const confirmed = window.confirm(
      [
        "이 주문을 완전히 삭제하시겠습니까?",
        "삭제 후 복구할 수 없습니다.",
        "",
        `주문번호: ${order.orderNumber}`,
        `고객명: ${order.customerName}`,
        `주문금액: ${formatPrice(order.totalAmount)}`,
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    onDelete();
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
    <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
      <div className="border-b p-5 shrink-0">
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
          {hasCancelledItems(order) && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              일부 품절취소
            </span>
          )}
          <p className="text-2xl font-black text-green-700">{formatPrice(order.totalAmount)}</p>
        </div>
      </div>

      <div className="p-5 space-y-5 overflow-y-auto flex-1">
        <button
          type="button"
          onClick={handlePrintReceipt}
          disabled={isPrinting}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPrinting ? "인쇄 준비 중..." : "영수증 인쇄"}
        </button>

        <StatusActions order={order} updating={updating} onUpdate={onUpdateStatus} onCancel={onCancel} />

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={() => setShowDangerActions((value) => !value)}
            className="flex w-full items-center justify-between text-left text-xs font-bold text-gray-700"
          >
            <span>고급/위험 작업</span>
            <span className="text-gray-400">{showDangerActions ? "접기" : "펼치기"}</span>
          </button>

          {showDangerActions && (
            <div className="mt-3 rounded-lg border border-red-100 bg-white p-3">
              <p className="text-xs font-bold text-red-800">주문삭제</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                주문 기록을 완전히 삭제합니다. 신규주문 또는 취소된 주문만 삭제할 수 있습니다.
              </p>
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                disabled={!canDeleteOrder || updating}
                placeholder="주문삭제"
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-gray-100 disabled:text-gray-400"
              />
              {!canDeleteOrder && (
                <p className="mt-2 text-[11px] font-semibold text-gray-500">
                  확인완료/배송완료 주문은 삭제할 수 없습니다. 필요한 경우 주문 전체 취소로 기록을 남겨 주세요.
                </p>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={updating || !canDeleteOrder || deleteConfirmText.trim() !== "주문삭제"}
                className="mt-3 inline-flex rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                주문삭제
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
          <h2 className="text-sm font-bold text-blue-900 mb-3">고객 정보</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-blue-500 font-semibold mr-2">고객</span>{order.customerName}</p>
            <p><span className="text-blue-500 font-semibold mr-2">연락처</span>{order.customerPhone}</p>
            <p><span className="text-blue-500 font-semibold mr-2">결제방식</span>{formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}</p>
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
              sortOrderItemsByProductCategory(order.items).map((item) => {
                const barcode = item.product?.barcode || "";
                const isItemCancelled = item.itemStatus === "CANCELLED";
                return (
                  <div
                    key={item.id}
                    className={`flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0 ${
                      isItemCancelled ? "text-gray-400" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-medium truncate ${isItemCancelled ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          {item.productName || "상품명 없음"}
                        </p>
                        {isItemCancelled && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                            품절취소
                          </span>
                        )}
                      </div>
                      {barcode && <p className="text-xs text-gray-500">바코드: {barcode}</p>}
                      <p className="text-xs text-gray-500">{formatPrice(item.unitPrice || 0)} x {item.quantity || 0}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className={`font-semibold ${isItemCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {formatPrice((item.unitPrice || 0) * (item.quantity || 0))}
                      </p>
                      {!isItemCancelled && (
                        <button
                          type="button"
                          onClick={() => onCancelItem(item)}
                          disabled={updating}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          품절취소
                        </button>
                      )}
                    </div>
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
  const [hasPendingOrders, setHasPendingOrders] = useState(false);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
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
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationRepeatActive, setNotificationRepeatActive] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<{
    tone: "green" | "red" | "gray";
    message: string;
  } | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const orderNotificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationEnabledRef = useRef(false);
  const hasPendingOrdersRef = useRef(false);
  const pendingCountRef = useRef(0);
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingPollInitializedRef = useRef(false);
  const lastResumeRefreshAtRef = useRef(0);

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

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    setLoadingOrderDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("주문 상세를 불러오지 못했습니다.");
      }
      const data = await res.json();
      setSelectedOrderDetail(data);
    } catch (error) {
      console.error("[admin/orders] order detail fetch failed", error);
      setSelectedOrderDetail(null);
    } finally {
      setLoadingOrderDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      void fetchOrderDetail(selectedOrderId);
    } else {
      setSelectedOrderDetail(null);
    }
  }, [selectedOrderId, fetchOrderDetail]);

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
        if (silent && currentSelectedId) {
          return currentSelectedId;
        }
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

  const getOrderNotificationAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

    if (!orderNotificationAudioRef.current) {
      const audio = new Audio("/notification.mp3");
      audio.preload = "auto";
      orderNotificationAudioRef.current = audio;
    }

    return orderNotificationAudioRef.current;
  }, []);

  const playOrderNotificationSound = useCallback(async () => {
    const audio = getOrderNotificationAudio();
    if (!audio) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      await audio.play();
      setSoundBlocked(false);
      console.log("[ORDER_NOTIFICATION_AUDIO_PLAY_SUCCESS]");
      return true;
    } catch (error) {
      console.error("[ORDER_NOTIFICATION_AUDIO_PLAY_FAILED]", error);
      setSoundBlocked(true);
      notificationEnabledRef.current = false;
      setNotificationEnabled(false);
      if (notificationRepeatIntervalRef.current) {
        clearInterval(notificationRepeatIntervalRef.current);
        notificationRepeatIntervalRef.current = null;
      }
      setNotificationRepeatActive(false);
      try {
        window.localStorage.setItem(ORDER_NOTIFICATION_ENABLED_STORAGE_KEY, "false");
        window.sessionStorage.removeItem(ORDER_NOTIFICATION_SESSION_ENABLED_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setNotificationFeedback({
        tone: "red",
        message: "브라우저에서 소리 재생이 차단되었습니다. 주문알림시작 버튼을 다시 눌러주세요.",
      });
      return false;
    }
  }, [getOrderNotificationAudio]);

  const stopNotificationRepeat = useCallback(() => {
    if (notificationRepeatIntervalRef.current) {
      clearInterval(notificationRepeatIntervalRef.current);
      notificationRepeatIntervalRef.current = null;
    }
    setNotificationRepeatActive(false);
    console.log("[ORDER_NOTIFICATION_REPEAT_STOP]");
  }, []);

  const syncPendingNotificationState = useCallback((nextOrders: Order[]) => {
    const nextPendingIds = new Set(
      nextOrders.filter((order) => order.status === "PENDING").map((order) => order.id),
    );
    const nextPendingCount = nextPendingIds.size;
    const nextHasPendingOrders = nextPendingCount > 0;

    setPendingCount(nextPendingCount);
    setHasPendingOrders(nextHasPendingOrders);
    pendingCountRef.current = nextPendingCount;
    hasPendingOrdersRef.current = nextHasPendingOrders;
    knownPendingOrderIdsRef.current = nextPendingIds;

    if (typeof window !== "undefined") {
      if (nextHasPendingOrders) {
        window.localStorage.setItem(
          ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY,
          JSON.stringify([...nextPendingIds]),
        );
      } else {
        window.localStorage.removeItem(ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY);
      }
    }

    if (!nextHasPendingOrders) {
      stopNotificationRepeat();
    }
  }, [stopNotificationRepeat]);

  const startNotificationRepeat = useCallback((restart = false) => {
    if (!notificationEnabledRef.current || !hasPendingOrdersRef.current) return;

    if (notificationRepeatIntervalRef.current) {
      if (!restart) return;
      clearInterval(notificationRepeatIntervalRef.current);
      notificationRepeatIntervalRef.current = null;
    }

    setNotificationRepeatActive(true);
    console.log("[ORDER_NOTIFICATION_REPEAT_START]");
    void playOrderNotificationSound();

    notificationRepeatIntervalRef.current = setInterval(() => {
      if (!notificationEnabledRef.current || !hasPendingOrdersRef.current) {
        stopNotificationRepeat();
        return;
      }

      void playOrderNotificationSound();
    }, ORDER_NOTIFICATION_REPEAT_MS);
  }, [playOrderNotificationSound, stopNotificationRepeat]);

  const startOrderNotifications = useCallback(async () => {
    const soundAllowed = await playOrderNotificationSound();
    if (soundAllowed) {
      notificationEnabledRef.current = true;
      setNotificationEnabled(true);
      setSoundBlocked(false);
      setNotificationFeedback({
        tone: "green",
        message: "알림 작동 중입니다. 주문접수 건이 있으면 알림음이 반복 재생됩니다.",
      });
      try {
        window.localStorage.setItem(ORDER_NOTIFICATION_ENABLED_STORAGE_KEY, "true");
        window.sessionStorage.setItem(ORDER_NOTIFICATION_SESSION_ENABLED_STORAGE_KEY, "true");
      } catch {
        /* ignore */
      }
      console.log("[ORDER_NOTIFICATION_ENABLED]");

      if (hasPendingOrdersRef.current) {
        startNotificationRepeat(true);
      }
    }
  }, [playOrderNotificationSound, startNotificationRepeat]);

  const testOrderNotification = useCallback(async () => {
    const soundAllowed = await playOrderNotificationSound();
    if (soundAllowed) {
      setNotificationFeedback({
        tone: "green",
        message: "알림 테스트 재생에 성공했습니다.",
      });
    }
  }, [playOrderNotificationSound]);

  const pollPendingOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/pending-count", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) router.replace("/admin");
        return;
      }

      const data = await res.json();
      const nextPendingCount = Number(data?.pendingCount) || 0;
      const nextHasPendingOrders = nextPendingCount > 0;
      const previousPendingCount = pendingCountRef.current;

      console.log("[ORDER_NOTIFICATION_POLL_SUCCESS]", nextPendingCount);
      setPendingCount(nextPendingCount);
      setHasPendingOrders(nextHasPendingOrders);
      pendingCountRef.current = nextPendingCount;
      hasPendingOrdersRef.current = nextHasPendingOrders;

      if (!nextHasPendingOrders) {
        stopNotificationRepeat();
        try {
          window.localStorage.removeItem(ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }

      const hasNewPending =
        nextPendingCount > previousPendingCount &&
        (pendingPollInitializedRef.current ||
          previousPendingCount > 0 ||
          notificationEnabledRef.current);

      if (hasNewPending) {
        setShowNewOrderAlert(true);
      }

      if (nextHasPendingOrders && notificationEnabledRef.current) {
        startNotificationRepeat(hasNewPending);
      }

      pendingPollInitializedRef.current = true;
    } catch (error) {
      console.error("[admin/orders] pending orders poll failed", error);
    }
  }, [router, startNotificationRepeat, stopNotificationRepeat]);

  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/today-summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTodaySummary(data);
    } catch (error) {
      console.error("[admin/orders] today-summary fetch failed", error);
    }
  }, []);

  const refreshAfterPageResume = useCallback((playSoundIfPending = false) => {
    const now = Date.now();
    if (now - lastResumeRefreshAtRef.current < 1000) return;
    lastResumeRefreshAtRef.current = now;

    void fetchOrders({ silent: true });
    void pollPendingOrders();
    void fetchTodaySummary();

    if (playSoundIfPending && notificationEnabledRef.current && hasPendingOrdersRef.current) {
      void playOrderNotificationSound();
      startNotificationRepeat();
    } else if (notificationEnabledRef.current && hasPendingOrdersRef.current) {
      startNotificationRepeat();
    }
  }, [fetchOrders, fetchTodaySummary, playOrderNotificationSound, pollPendingOrders, startNotificationRepeat]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders({ silent: true });
    }, ORDER_LIST_AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sessionEnabled = window.sessionStorage.getItem(ORDER_NOTIFICATION_SESSION_ENABLED_STORAGE_KEY) === "true";
      notificationEnabledRef.current = sessionEnabled;
      setNotificationEnabled(sessionEnabled);

      if (!sessionEnabled && window.localStorage.getItem(ORDER_NOTIFICATION_ENABLED_STORAGE_KEY) === "true") {
        setNotificationFeedback({
          tone: "gray",
          message: "새로 실행한 화면에서는 소리 권한 확인이 필요합니다. 주문알림시작을 눌러주세요.",
        });
      }

      try {
        const savedPendingIds = JSON.parse(
          window.localStorage.getItem(ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY) || "[]",
        );
        if (Array.isArray(savedPendingIds)) {
          knownPendingOrderIdsRef.current = new Set(
            savedPendingIds.filter((id): id is string => typeof id === "string" && id.length > 0),
          );
        }
      } catch {
        window.localStorage.removeItem(ORDER_NOTIFICATION_KNOWN_PENDING_IDS_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopNotificationRepeat();
      const audio = orderNotificationAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [stopNotificationRepeat]);

  useEffect(() => {
    fetchTodaySummary();
    const interval = setInterval(fetchTodaySummary, TODAY_SUMMARY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchTodaySummary]);

  const notificationPollIntervalMs = isPageHidden ? ORDER_NOTIFICATION_HIDDEN_POLL_MS : ORDER_NOTIFICATION_VISIBLE_POLL_MS;

  useEffect(() => {
    void pollPendingOrders();
    const interval = setInterval(() => {
      void pollPendingOrders();
    }, notificationPollIntervalMs);
    return () => clearInterval(interval);
  }, [notificationPollIntervalMs, pollPendingOrders]);

  useEffect(() => {
    notificationEnabledRef.current = notificationEnabled;
    hasPendingOrdersRef.current = hasPendingOrders;

    if (notificationEnabled && hasPendingOrders) {
      startNotificationRepeat();
    } else {
      stopNotificationRepeat();
    }
  }, [hasPendingOrders, notificationEnabled, startNotificationRepeat, stopNotificationRepeat]);

  useEffect(() => {
    setIsPageHidden(document.hidden);

    const handleVisibilityChange = () => {
      setIsPageHidden(document.hidden);

      if (!document.hidden) {
        refreshAfterPageResume(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshAfterPageResume]);

  useEffect(() => {
    const handleFocus = () => {
      refreshAfterPageResume();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshAfterPageResume]);

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

      const updatedOrder = await res.json();
      setSelectedOrderDetail(updatedOrder);
      setOrders((current) => {
        const nextOrders = current.map((order) => (order.id === selectedOrderId ? { ...order, status } : order));
        syncPendingNotificationState(nextOrders);
        return nextOrders;
      });
      fetchTodaySummary();
      void fetchOrders({ silent: true });
      void pollPendingOrders();
    } catch (error) {
      console.error("[admin/orders] status update failed", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function cancelOrder() {
    if (!selectedOrderId) return;
    if (!confirm("주문 전체를 취소하시겠습니까?\n주문 기록은 남고 매출 합계에서 제외됩니다.")) return;
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

      setOrders((current) => {
        const nextOrders: Order[] = current.map((order) =>
          order.id === selectedOrderId ? { ...order, status: "CANCELLED" } : order,
        );
        syncPendingNotificationState(nextOrders);
        return nextOrders;
      });
      fetchTodaySummary();
      void fetchOrders({ silent: true });
      void pollPendingOrders();
    } catch (error) {
      console.error("[admin/orders] cancel failed", error);
      alert("주문 취소 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function cancelOrderItem(item: OrderItem) {
    if (!selectedOrderId) return;
    if (item.itemStatus === "CANCELLED") return;
    if (!confirm(`${item.productName || "상품"} 상품 1개만 품절취소 처리할까요?`)) return;

    setUpdatingOrderId(selectedOrderId);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrderId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemStatus: "CANCELLED" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "상품 품절취소 처리에 실패했습니다.");
        return;
      }

      setOrders((current) =>
        current.map((order) => {
          if (order.id !== selectedOrderId) return order;

          const nextItems = (order.items || []).map((orderItem) =>
            orderItem.id === item.id ? { ...orderItem, itemStatus: "CANCELLED" } : orderItem,
          );

          const nextTotalAmount = nextItems.reduce((sum, orderItem) => {
            if (orderItem.itemStatus === "CANCELLED") return sum;
            return sum + Number(orderItem.unitPrice ?? 0) * Number(orderItem.quantity ?? 0);
          }, 0);

          return {
            ...order,
            totalAmount: Number(data.totalAmount ?? nextTotalAmount),
            items: nextItems,
          };
        }),
      );
      fetchTodaySummary();
      void fetchOrders({ silent: true });
    } catch (error) {
      console.error("[admin/orders] item cancel failed", error);
      alert("상품 품절취소 처리 중 오류가 발생했습니다.");
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

      setOrders((current) => {
        const nextOrders = current.filter((order) => order.id !== selectedOrderId);
        syncPendingNotificationState(nextOrders);
        return nextOrders;
      });
      setSelectedOrderId(null);
      fetchTodaySummary();
      void fetchOrders({ silent: true });
      void pollPendingOrders();
      alert("주문이 삭제되었습니다.");
    } catch (error) {
      console.error("[admin/orders] delete failed", error);
      alert("주문 삭제 중 오류가 발생했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const notificationStatus = soundBlocked
    ? {
        tone: "red",
        title: "소리 차단됨",
        description: "브라우저에서 소리 재생이 차단되었습니다. 주문알림시작 버튼을 다시 눌러주세요.",
      }
    : !notificationEnabled
      ? {
          tone: "red",
          title: "알림음 꺼짐",
          description: "알림음이 꺼져 있습니다. 주문알림시작을 눌러주세요.",
        }
      : hasPendingOrders && notificationRepeatActive
        ? {
            tone: "yellow",
            title: "알림 작동 중",
            description: `주문접수 ${pendingCount}건이 남아 있어 10초마다 알림음을 재생합니다.`,
          }
        : {
            tone: "green",
            title: "알림 작동 중",
            description: "주문접수 건이 생기면 알림음을 반복 재생합니다.",
          };

  const notificationStatusClass =
    notificationStatus.tone === "green"
      ? "border-green-200 bg-green-50 text-green-900"
      : notificationStatus.tone === "yellow"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : notificationStatus.tone === "gray"
          ? "border-gray-200 bg-white text-gray-700"
          : "border-red-200 bg-red-50 text-red-900";

  const notificationButtonClass = notificationEnabled
    ? "rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700"
    : "rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-black";

  const notificationFeedbackClass =
    notificationFeedback?.tone === "green"
      ? "border-green-200 bg-green-50 text-green-800"
      : notificationFeedback?.tone === "red"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {(soundBlocked || !notificationEnabled) && (
          <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-black text-red-900">
                  {soundBlocked
                    ? "브라우저에서 소리 재생이 차단되었습니다. 주문알림시작 버튼을 다시 눌러주세요."
                    : "알림음이 꺼져 있습니다. 주문알림시작을 눌러주세요."}
                </p>
                <p className="mt-1 text-sm font-semibold text-red-700">
                  신규 주문을 놓치지 않으려면 이 화면에서 알림음을 한 번 재생해 소리 권한을 허용해야 합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void startOrderNotifications()}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                주문알림시작
              </button>
            </div>
          </div>
        )}

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={() => void startOrderNotifications()}
              className={notificationButtonClass}
            >
              {notificationEnabled ? "✅ 알림 작동 중" : "🔔 주문알림시작"}
            </button>
            <button
              type="button"
              onClick={() => void testOrderNotification()}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              🔊 알림 테스트
            </button>
            <div className={`rounded-2xl border px-4 py-3 shadow-sm ${notificationStatusClass}`}>
              <p className="text-sm font-bold">{notificationStatus.title}</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-5">{notificationStatus.description}</p>
              {notificationFeedback && (
                <p className={`mt-2 rounded-lg border px-2 py-1 text-xs font-bold ${notificationFeedbackClass}`}>
                  {notificationFeedback.message}
                </p>
              )}
            </div>
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
                          order={selectedOrderDetail}
                          updating={updatingOrderId === selectedOrderId}
                          onUpdateStatus={updateStatus}
                          onCancel={cancelOrder}
                          onCancelItem={cancelOrderItem}
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
                  order={selectedOrderDetail}
                  updating={updatingOrderId === selectedOrderId}
                  onUpdateStatus={updateStatus}
                  onCancel={cancelOrder}
                  onCancelItem={cancelOrderItem}
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
