"use client";

import { useState, useEffect } from "react";
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

type Props = {
  params: {
    orderNumber: string;
  };
};

export default function OrderCheckByNumberPage({ params }: Props) {
  const orderNumber = params.orderNumber;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        const data = await parseJsonResponse<Order | { error?: string }>(res);

        if (!res.ok) {
          throw new Error("error" in data && data.error ? data.error : "조회에 실패했습니다.");
        }

        setOrder(data as Order);
      } catch (err) {
        setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderNumber]);

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-green-800">주문 조회</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          주문번호: <span className="font-mono font-bold text-gray-800">{orderNumber}</span>
        </p>

        {loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">조회 중입니다...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {order && !loading && !error && (
          <div className="bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="flex justify-between items-start gap-2 mb-2">
              <span className="font-mono text-xs sm:text-sm font-bold text-gray-800">{order.orderNumber}</span>
              <span
                className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full ${ORDER_STATUS_COLOR[order.status as OrderStatus]}`}
              >
                {ORDER_STATUS_LABEL[order.status as OrderStatus]}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">
              {new Date(order.createdAt).toLocaleString("ko-KR")}
            </p>
            <p className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
              {order.customerName}님 · {FULFILLMENT_TYPE_LABEL[order.fulfillmentType as FulfillmentType]}
              {order.fulfillmentType === "PICKUP" && order.pickupTime
                ? ` ${formatPickupTimeLabel(order.pickupTime)}`
                : ""}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">
              {formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}
            </p>
            <div className="text-xs sm:text-sm text-gray-600 space-y-1 border-t pt-1.5 sm:pt-2">
              {order.items.map((item: OrderItem) => (
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
        )}

        <button
          onClick={() => window.location.href = "/"}
          className="mt-6 sm:mt-8 w-full border text-gray-600 px-6 py-4 rounded-xl font-semibold text-sm sm:text-base min-h-[48px]"
        >
          쇼핑으로 돌아가기
        </button>
      </div>
    </div>
  );
}
