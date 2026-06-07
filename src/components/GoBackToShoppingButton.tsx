"use client";

import { useRouter } from "next/navigation";

export function GoBackToShoppingButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/")}
      className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition min-h-[44px] px-6 py-3"
    >
      🛒 쇼핑으로 돌아가기
    </button>
  );
}