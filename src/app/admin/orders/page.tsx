"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ORDER_STATUS_FLOW,
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

// ✅ 서버에서 보내준 JSON 데이터와 일치하는 타입 정의
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isMounted = useRef(true);
  const isFetching = useRef(false);
  const {
    isPlaying,
    pendingCount,
    autoplayBlocked,
    startNotification,
    stopNotification,
    updatePendingCount,
    setNotificationConfig,
    enableAudio,
  } = useOrderNotification();

  // ✅ 데이터를 가져오는 핵심 함수
  const fetchOrders = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    
    try {
      const params = filter ? `?status=${filter}` : "";
      // 💡 아까 확인한 관리자 전용 API 주소 사용
      const res = await fetch(`/api/admin/orders${params}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "데이터를 불러오지 못했습니다.");
      }

      const data = await res.json();
      if (isMounted.current) {
        setOrders(data);

        // 대기 중인 주문 수 확인 및 알림 처리
        const pendingOrders = data.filter((order: Order) => order.status === "PENDING");
        const pendingCount = pendingOrders.length;
        updatePendingCount(pendingCount);

        // 페이지 타이틀 업데이트 (대기 주문이 있으면 표시)
        if (pendingCount > 0) {
          document.title = `(${pendingCount}) 주문 관리 - 한사랑마트`;
        } else {
          document.title = "주문 관리 - 한사랑마트";
        }
      }
    } catch (error) {
      console.error("로딩 에러:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      isFetching.current = false;
    }
  }, [filter, router, updatePendingCount]);

  useEffect(() => {
    isMounted.current = true;
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // 30초마다 자동 새로고침

    // 브라우저 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.hidden && pendingCount > 0) {
        // 백그라운드 상태에서 알림 표시
        if (Notification.permission === "granted") {
          new Notification("새 주문 접수", {
            body: `${pendingCount}개의 대기 중인 주문이 있습니다.`,
            icon: "/icon.png",
            tag: "order-notification",
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 알림 권한 요청
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchOrders, pendingCount]);

  async function updateStatus(id: string, status: OrderStatus) {
    try {
      console.log(`주문 상태 변경 시도: ID=${id}, Status=${status}`);
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const responseText = await res.text();
      console.log(`API 응답 상태: ${res.status}`);
      console.log(`API 응답 내용: ${responseText}`);

      if (res.ok) {
        // 주문 승인 또는 취소 시 알림 중지
        if (status === "APPROVED" || status === "CANCELLED") {
          stopNotification();
        }
        fetchOrders();
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { error: responseText || "상태 변경에 실패했습니다." };
      }
      alert(data.error ?? "상태 변경에 실패했습니다.");
    } catch (error) {
      console.error(error);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  }

  function cancelOrder(id: string, orderNumber: string) {
    if (!confirm(`주문 ${orderNumber}을(를) 취소하시겠습니까?`)) return;
    updateStatus(id, "CANCELLED");
  }

  // 알림 설정 토글
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationInterval, setNotificationInterval] = useState(3000);

  const handleNotificationConfigChange = () => {
    setNotificationConfig({ interval: notificationInterval });
    setShowNotificationSettings(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
            {/* 대기 주문 배지 */}
            {pendingCount > 0 && (
              <div className={`relative inline-flex items-center ${isPlaying ? 'animate-pulse' : ''}`}>
                <span className="absolute flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="ml-4 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  대기 {pendingCount}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNotificationSettings(!showNotificationSettings)}
              className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              title="알림 설정"
            >
              🔔 설정
            </button>
            <button
              onClick={() => fetchOrders()}
              className="text-sm text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 알림 설정 패널 */}
        {showNotificationSettings && (
          <div className="bg-white rounded-2xl border p-4 mb-6">
            <h3 className="font-semibold mb-3">알림 설정</h3>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">
                알림 반복 간격 (초):
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={notificationInterval / 1000}
                onChange={(e) => setNotificationInterval(Number(e.target.value) * 1000)}
                className="px-3 py-1.5 border rounded-lg w-20"
              />
              <button
                onClick={handleNotificationConfigChange}
                className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 text-sm"
              >
                적용
              </button>
              <button
                onClick={() => stopNotification()}
                className="bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 text-sm"
              >
                알림 중지
              </button>
            </div>
          </div>
        )}

        {/* 자동 재생 차단 알림 */}
        {autoplayBlocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔊</span>
              <div>
                <p className="font-semibold text-yellow-800">알림음 자동 재생이 차단되었습니다</p>
                <p className="text-sm text-yellow-700">브라우저 정책으로 인해 사용자 상호작용이 필요합니다.</p>
              </div>
            </div>
            <button
              onClick={enableAudio}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-medium"
            >
              알림음 활성화
            </button>
          </div>
        )}

        {/* 필터 버튼 영역 */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilter("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!filter ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
          >
            전체
          </button>
          {ORDER_STATUS_FILTER.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === s ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
            >
              {ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* 주문 리스트 영역 */}
        {loading && orders.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
            주문 내역이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg text-gray-900">{order.orderNumber}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ORDER_STATUS_COLOR[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      주문일시: {new Date(order.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-green-700">{formatPrice(Number(order.totalAmount))}</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
                      {order.fulfillmentType === "PICKUP" && order.pickupTime
                        ? ` · ${formatPickupTimeLabel(order.pickupTime)}`
                        : ""}
                      {" · "}
                      {formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
                    <p className="mb-1">
                      <span className="text-blue-400 font-bold mr-2">고객</span>
                      <span className="font-semibold text-gray-900">{order.customerName}</span> 
                      <span className="text-gray-500 ml-1">({order.customerPhone})</span>
                    </p>
                    {order.fulfillmentType === "PICKUP" ? (
                      <>
                        <p>
                          <span className="text-blue-400 font-bold mr-2">픽업</span>
                          <span className="text-gray-800 font-semibold">
                            {order.pickupTime
                              ? formatPickupTimeLabel(order.pickupTime)
                              : "시간 미지정"}
                          </span>
                        </p>
                        <p className="leading-relaxed text-gray-600 text-xs mt-1">
                          {STORE.name} · {STORE.address}
                        </p>
                      </>
                    ) : (
                      <p className="leading-relaxed">
                        <span className="text-blue-400 font-bold mr-2">주소</span>
                        <span className="text-gray-800">{order.deliveryAddress}</span>
                      </p>
                    )}
                  </div>
                  <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50">
                    <p className="mb-1">
                      <span className="text-amber-500 font-bold mr-2">품절대응</span>
                      <span className="text-gray-800">{OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy]}</span>
                    </p>
                    {order.memo && (
                      <p>
                        <span className="text-amber-500 font-bold mr-2">요청사항</span>
                        <span className="text-gray-800 italic">"{order.memo}"</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 주문 상품 목록 */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">
                        {orderItemName(item)}{" "}
                        <span className="text-gray-400 ml-1">x {item.quantity}</span>
                      </span>
                      <span className="font-mono text-gray-500">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-4 mb-3">
                  <button
                    type="button"
                    onClick={() => printReceiptNow({
                      ...order,
                      totalAmount: Number(order.totalAmount),
                      items: order.items.map(item => ({
                        ...item,
                        unitPrice: Number(item.unitPrice),
                      })),
                    })}
                    className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 font-medium"
                  >
                    🖨️ 영수증 인쇄
                  </button>
                </div>

                {/* 상태 관리 버튼 */}
                <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                  {ORDER_STATUS_FLOW.map((s) => (
                    <span key={s} className="contents">
                      <button
                        type="button"
                        onClick={() => updateStatus(order.id, s)}
                        disabled={order.status === s || order.status === "CANCELLED"}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          order.status === s
                            ? "bg-gray-800 text-white border-gray-800 font-bold"
                            : "bg-white text-gray-500 border-gray-200 hover:border-green-500 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {ORDER_STATUS_LABEL[s]}
                      </button>
                      {s === "APPROVED" && order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                        <button
                          type="button"
                          onClick={() => cancelOrder(order.id, order.orderNumber)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 font-medium transition-all"
                        >
                          주문취소
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}