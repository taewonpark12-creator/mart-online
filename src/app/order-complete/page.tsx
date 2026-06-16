"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";

function OrderCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(
    searchParams.get("orderNumber") || "",
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("completedOrder");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (typeof parsed?.orderNumber === "string") {
        setOrderNumber(parsed.orderNumber);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <main className="mx-auto max-w-md px-4 py-8">
        <section className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl font-black text-green-700">
            ✓
          </div>
          <h1 className="mb-2 text-2xl font-black text-green-800">
            주문이 접수되었습니다
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            주문번호:{" "}
            <span className="font-mono font-bold text-gray-900">
              {orderNumber || "확인 중"}
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
