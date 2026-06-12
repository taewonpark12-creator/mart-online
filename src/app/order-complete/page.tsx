"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { BANK_ACCOUNT } from "@/lib/types";

function OrderCompletePageContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || "";

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="bg-white border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center shadow-sm">
          <span className="text-5xl sm:text-6xl block mb-4">✅</span>
          <h1 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">주문이 접수되었습니다!</h1>
          <p className="text-gray-500 text-sm sm:text-base mb-6">
            주문번호: <span className="font-mono font-bold text-gray-800">{orderNumber}</span>
          </p>
          <p className="text-sm text-gray-600 mb-6">
            주문이 확인되면 연락드리겠습니다.
            <br />
            감사합니다.
          </p>

          {orderNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-left mb-6">
              <p className="font-semibold text-blue-900 mb-1">입금 계좌</p>
              <p className="font-mono font-bold text-gray-900">{BANK_ACCOUNT.display}</p>
            </div>
          )}

          <div>
  <button
    onClick={() => window.location.href = "/"}
    className="w-full border text-gray-600 px-6 py-4 rounded-xl font-semibold text-sm sm:text-base min-h-[48px]"
  >
    계속 쇼핑하기
  </button>
</div>
        </div>
      </div>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8faf8] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">로딩 중입니다...</p>
      </div>
    </div>}>
      <OrderCompletePageContent />
    </Suspense>
  );
}
