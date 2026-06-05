"use client";

import { formatPrice } from "@/lib/types";

type Props = {
  itemCount: number;
  totalAmount: number;
  onOrderClick: () => void;
};

export function OrderBar({ itemCount, totalAmount, onOrderClick }: Props) {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-green-600 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-white text-xl sm:text-2xl">🛒</span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-white font-semibold text-sm sm:text-base">
                {itemCount}개 상품
              </span>
              <span className="text-white/80 text-sm sm:text-base hidden sm:inline">·</span>
              <span className="text-white font-bold text-base sm:text-lg">
                {formatPrice(totalAmount)}
              </span>
            </div>
          </div>
          <button
            onClick={onOrderClick}
            className="bg-white hover:bg-gray-50 text-green-700 font-bold px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl transition shadow-lg text-sm sm:text-base min-h-[48px] sm:min-h-[52px]"
          >
            주문하기
          </button>
        </div>
      </div>
      {/* Safe area for mobile devices with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)] bg-green-600" />
    </div>
  );
}
