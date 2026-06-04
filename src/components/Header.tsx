import Link from "next/link";

type Props = {
  cartCount?: number;
  onCartClick?: () => void;
};

export function Header({ cartCount = 0, onCartClick }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-green-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl">🏪</span>
          <div>
            <p className="font-bold text-green-800 text-sm sm:text-base leading-tight">한사랑마트</p>
            <p className="text-[10px] sm:text-xs text-green-600 hidden sm:block">온라인 배달 주문</p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-4">
          <Link
            href="/order-check"
            className="text-[10px] sm:text-xs text-gray-500 hover:text-green-700 transition"
          >
            주문 확인
          </Link>

          {onCartClick && (
            <button
              onClick={onCartClick}
              className="relative flex items-center gap-1 sm:gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-3 sm:py-2 rounded-full transition min-h-[44px]"
            >
              <span className="hidden sm:inline">🛒 장바구니</span>
              <span className="sm:hidden">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] sm:text-xs w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}