"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { formatPrice, MIN_ORDER_AMOUNT } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, totalAmount } = useCart();
  const [error, setError] = useState("");

  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;
  const amountShort = MIN_ORDER_AMOUNT - totalAmount;

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    const result = updateQuantity(productId, newQuantity);
    if (!result.success) {
      setError(result.message || "수량 변경 실패");
    } else {
      setError("");
    }
  };

  const handleRemove = (productId: string) => {
    removeItem(productId);
  };

  const handleCheckout = () => {
    if (!meetsMinimum) {
      setError(`최소 주문 금액은 ${formatPrice(MIN_ORDER_AMOUNT)}입니다.`);
      return;
    }
    router.push("/checkout");
  };

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-green-800">장바구니</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          담은 상품을 확인하고 주문을 진행하세요.
        </p>

        {items.length === 0 ? (
          <div className="bg-white border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <span className="text-4xl sm:text-5xl mb-4 block">🛒</span>
            <p className="text-gray-500 text-sm sm:text-base mb-6">장바구니가 비어 있습니다.</p>
            <button
              onClick={() => router.push("/")}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold text-sm sm:text-base min-h-[44px]"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {items.map((item) => (
                <div key={item.productId} className="bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate mb-1">{item.name}</p>
                      <p className="text-green-700 font-semibold text-sm sm:text-base">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 sm:mt-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white border text-sm sm:text-base font-bold min-h-[44px]"
                      >
                        −
                      </button>
                      <span className="w-8 sm:w-6 text-center text-sm sm:text-base font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        disabled={!!(item.maxOrderQuantity && item.maxOrderQuantity > 0 && item.quantity >= item.maxOrderQuantity)}
                        className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white border text-sm sm:text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      className="text-gray-400 hover:text-red-500 text-sm sm:text-base min-h-[32px]"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex justify-between font-bold text-base sm:text-lg">
                <span>합계</span>
                <span className="text-green-700">{formatPrice(totalAmount)}</span>
              </div>

              {!meetsMinimum && (
                <p className="text-xs sm:text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 sm:py-3">
                  {formatPrice(MIN_ORDER_AMOUNT)} 이상 주문 가능합니다.{" "}
                  <span className="font-medium">{formatPrice(amountShort)}</span> 더 담아주세요.
                </p>
              )}

              {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}

              <button
                onClick={handleCheckout}
                disabled={!meetsMinimum}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 sm:py-5 rounded-xl transition text-sm sm:text-base min-h-[48px]"
              >
                주문하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
