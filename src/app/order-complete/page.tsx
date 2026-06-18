"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/types";
import { FULFILLMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/types";

const OUT_OF_STOCK_POLICY_LABEL: Record<string, string> = {
  SUBSTITUTE: "대체상품 받기",
  CANCEL_ONLY: "품절된 상품만 취소",
  CONTACT: "연락바람",
};

function OrderCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderNumber, setOrderNumber] = useState(
    searchParams.get("orderNumber") || "",
  );
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cartCleared, setCartCleared] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lovemart:lastOrder");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (typeof parsed?.orderNumber === "string") {
        setOrderNumber(parsed.orderNumber);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      setError(true);
      return;
    }
    fetchOrder();
  }, [orderNumber]);

  async function fetchOrder() {
    try {
      const res = await fetch(`/api/orders/check?orderNumber=${orderNumber}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        // Clear cart after successfully loading order data
        if (!cartCleared) {
          clearCart();
          setCartCleared(true);
        }
      } else {
        setError(true);
      }
    } catch (error) {
      console.error("[order-complete] fetch error", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <Header />
        <main className="mx-auto max-w-md px-4 py-8">
          <section className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl font-black text-orange-700">
              !
            </div>
            <h1 className="mb-2 text-2xl font-black text-gray-800">
              주문 완료 정보를 불러올 수 없습니다
            </h1>
            <p className="mb-6 text-sm text-gray-500">
              주문이 정상 접수되었는지 확인이 필요하시면 매장으로 문의해주세요.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => router.push("/order-check")}
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white"
              >
                주문 조회하기
              </button>
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="w-full rounded-xl border px-4 py-3 text-sm font-bold text-gray-600"
              >
                홈으로 이동
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <main className="mx-auto max-w-md px-4 py-8">
        <section className="rounded-2xl border bg-white p-8 text-center shadow-sm mb-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl font-black text-green-700">
            ✓
          </div>
          <h1 className="mb-2 text-2xl font-black text-green-800">
            주문이 접수되었습니다
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            주문번호:{" "}
            <span className="font-mono font-bold text-gray-900">
              {order.orderNumber}
            </span>
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => router.push("/order-check")}
              className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white"
            >
              주문 조회하기
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold text-gray-600"
            >
              쇼핑 계속하기
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">주문 내역</h2>
          <div className="space-y-3">
            {Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {item.productName || "상품명 없음"} x {item.quantity || 0}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatPrice((item.unitPrice || 0) * (item.quantity || 0))}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">주문 상품 정보가 없습니다.</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between text-base font-black">
            <span>총액</span>
            <span className="text-green-700">{formatPrice(order.totalAmount || 0)}</span>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">고객 정보</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-gray-600">고객명:</span> {order.customerName || "-"}</p>
            <p><span className="font-semibold text-gray-600">연락처:</span> {order.customerPhone || "-"}</p>
            <p><span className="font-semibold text-gray-600">수령 방법:</span> {FULFILLMENT_TYPE_LABEL[order.fulfillmentType as keyof typeof FULFILLMENT_TYPE_LABEL] || "-"}</p>
            {order.fulfillmentType === "DELIVERY" && (
              <p><span className="font-semibold text-gray-600">배송 주소:</span> {order.deliveryAddress || "-"}</p>
            )}
            {order.fulfillmentType === "PICKUP" && (
              <p><span className="font-semibold text-gray-600">픽업 시간:</span> {order.pickupTime || "-"}</p>
            )}
            {order.paymentMethod && (
              <p><span className="font-semibold text-gray-600">결제 방법:</span> {PAYMENT_METHOD_LABEL[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABEL] || "-"}</p>
            )}
            {order.outOfStockPolicy && (
              <p><span className="font-semibold text-gray-600">품절 시 처리방법:</span> {OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy] || "-"}</p>
            )}
            {order.memo && (
              <p><span className="font-semibold text-gray-600">요청사항:</span> {order.memo}</p>
            )}
          </div>
        </section>

        {order.fulfillmentType === "DELIVERY" && order.paymentMethod === "BANK_TRANSFER" && (
          <section className="rounded-2xl border bg-blue-50 p-6 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-blue-900 mb-4">계좌이체 정보</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-blue-800">계좌번호:</span> <span className="font-bold text-blue-900">국민은행 654937-01-011941 한사랑마트</span></p>
              <p className="text-blue-700 mt-2">품절 상품이 있을 수 있으니 매장에서 연락드린 후 계좌이체해주세요.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8faf8]" />}>
      <OrderCompleteContent />
    </Suspense>
  );
}
