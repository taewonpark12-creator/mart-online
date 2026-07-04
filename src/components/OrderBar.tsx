"use client";

import { formatPrice } from "@/lib/types";
import { getMinimumOrderAmount, isMinOrderEventActive } from "@/lib/min-order";

type Props = {
  itemCount: number;
  totalAmount: number;
  onOrderClick: () => void;
};

export function OrderBar({ itemCount, totalAmount, onOrderClick }: Props) {
  if (itemCount === 0) return null;

  const minimumOrderAmount = getMinimumOrderAmount();
  const eventActive = isMinOrderEventActive();
  const remainingAmount = Math.max(minimumOrderAmount - totalAmount, 0);
  const minimumOrderMessage =
    eventActive && remainingAmount > 0
      ? `온라인 주문 오픈 이벤트! ${formatPrice(minimumOrderAmount)} 이상 주문 가능`
      : remainingAmount === 0
      ? "주문 가능"
      : totalAmount === 0
        ? `${formatPrice(minimumOrderAmount)} 이상 배송`
        : `${formatPrice(remainingAmount)} 남음`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-green-600 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-2 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-white">
            <span className="shrink-0 text-sm sm:text-2xl" aria-hidden>
              🛒
            </span>
            <span className="shrink-0 text-sm font-bold sm:text-base">{itemCount}개 담김</span>
            <span className="hidden text-sm text-white/75 sm:inline">·</span>
            <span className="truncate text-sm font-black sm:text-lg">{formatPrice(totalAmount)}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-white/85 sm:text-sm">
            {minimumOrderMessage}
          </p>
        </div>
        <button
          onClick={onOrderClick}
          className="min-h-[44px] shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-green-700 shadow-md transition hover:bg-gray-50 sm:min-h-[52px] sm:px-8 sm:text-base"
        >
          주문하기
        </button>
      </div>
      {/* Safe area for mobile devices with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)] bg-green-600" />
    </div>
  );
}
