"use client";

import { useRouter } from "next/navigation";

export function GoBackToShoppingButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/")}
      className="bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl shadow-md active:scale-95 transition min-h-[40px] px-5 py-2.5"
    >
      🛒 쇼핑으로 돌아가기
    </button>
  );
}