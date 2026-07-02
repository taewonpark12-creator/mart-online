import Link from "next/link";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { MART_ICON_SRC, MART_NAME, MART_SUBTITLE } from "@/lib/brand";

type Props = {
  cartCount?: number;
  showInstallButton?: boolean;
};

export function Header({ cartCount = 0, showInstallButton = false }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-green-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <img
              src={MART_ICON_SRC}
              alt=""
              aria-hidden="true"
              className="h-7 w-7 shrink-0 rounded-md object-contain sm:h-8 sm:w-8"
            />
            <div className="min-w-0">
              <p className="truncate font-bold text-green-800 text-sm sm:text-base leading-tight">
                {MART_NAME}
              </p>
              <p className="text-[10px] sm:text-xs text-green-600 hidden sm:block">
                {MART_SUBTITLE}
              </p>
            </div>
          </Link>

          {showInstallButton && <PwaInstallButton variant="header" />}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4">
          <Link
            href="/order-check"
            className="bg-green-100 hover:bg-green-200 text-green-800 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-full transition min-h-[44px] flex items-center"
          >
            📦 주문 확인
          </Link>

          <Link
            href="/cart"
            className="relative flex items-center gap-1 sm:gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-3 sm:py-2 rounded-full transition min-h-[44px]"
          >
            <span className="hidden sm:inline">🛒 장바구니</span>
            <span className="sm:hidden">🛒</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] sm:text-xs w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
