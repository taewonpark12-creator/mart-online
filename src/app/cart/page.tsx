"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { formatPrice, MIN_ORDER_AMOUNT } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { GoBackToShoppingButton } from "@/components/GoBackToShoppingButton";
import type { CartItem } from "@/lib/types";

type CartDiscount =
  | { hasDiscount: true; normalPrice: number; eventPrice: number; discountRate: number }
  | { hasDiscount: false };

function getCartDiscount(item: CartItem): CartDiscount {
  const normalPrice = Number(item.normalPrice);
  const eventPrice = Number(item.eventPrice);
  const discountRate = Number(item.discountRate);
  const hasDiscount =
    Number.isFinite(normalPrice) &&
    Number.isFinite(eventPrice) &&
    Number.isFinite(discountRate) &&
    normalPrice > 0 &&
    eventPrice > 0 &&
    eventPrice < normalPrice &&
    discountRate > 0;

  return hasDiscount
    ? { hasDiscount, normalPrice, eventPrice, discountRate }
    : { hasDiscount: false };
}

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, totalAmount } = useCart();
  const [error, setError] = useState("");
  const [confirmingDeleteProductId, setConfirmingDeleteProductId] = useState<string | null>(null);

  const meetsMinimum = totalAmount >= MIN_ORDER_AMOUNT;
  const amountShort = MIN_ORDER_AMOUNT - totalAmount;

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    const result = updateQuantity(productId, newQuantity);
    if (!result.success) {
      setError(result.message || "수량 변경에 실패했습니다.");
    } else {
      setError("");
    }
  };

  const handleRemove = (productId: string) => {
    removeItem(productId);
    setConfirmingDeleteProductId(null);
  };

  const handleDeleteClick = (productId: string) => {
    setConfirmingDeleteProductId(productId);
  };

  const handleDeleteCancel = () => {
    setConfirmingDeleteProductId(null);
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
            <span className="text-4xl sm:text-5xl mb-4 block">장바구니</span>
            <p className="text-gray-500 text-sm sm:text-base mb-6">장바구니가 비어 있습니다.</p>
            <GoBackToShoppingButton />
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {items.map((item) => {
                const discount = getCartDiscount(item);

                return (
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
                      {discount.hasDiscount ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(discount.normalPrice)}
                            </span>
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                              {discount.discountRate}% Off
                            </span>
                          </div>
                          <p className="text-green-700 font-semibold text-sm sm:text-base">
                            {formatPrice(discount.eventPrice)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-gray-500">
                              합계 {formatPrice(item.price * item.quantity)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-green-700 font-semibold text-sm sm:text-base">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      )}
                      {item.maxOrderQuantity && item.maxOrderQuantity > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          최대 {item.maxOrderQuantity}개 구매 가능
                        </p>
                      )}
                      {item.isOutOfStock && (
                        <p className="text-xs text-red-500 mt-1">품절된 상품입니다.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 sm:mt-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1 || item.isOutOfStock}
                        className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white border text-sm sm:text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100 min-h-[44px]"
                      >
                        -
                      </button>
                      <span className="w-8 sm:w-6 text-center text-sm sm:text-base font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.isOutOfStock || !!(item.maxOrderQuantity && item.maxOrderQuantity > 0 && item.quantity >= item.maxOrderQuantity)}
                        className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white border text-sm sm:text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100 min-h-[44px]"
                      >
                        +
                      </button>
                    </div>
                    {confirmingDeleteProductId === item.productId ? (
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-gray-600 mb-1">상품을 삭제할까요?</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDeleteCancel}
                            className="text-gray-500 hover:text-gray-700 text-sm sm:text-base min-h-[44px] px-3 py-2"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleRemove(item.productId)}
                            className="text-red-500 hover:text-red-700 text-sm sm:text-base min-h-[44px] px-3 py-2 font-medium"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(item.productId)}
                        className="text-gray-400 hover:text-red-500 text-sm sm:text-base min-h-[44px] flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
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
              <div className="flex justify-center mt-4">
                <GoBackToShoppingButton />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
