import Link from "next/link";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { MART_ICON_SRC, MART_NAME, MART_SUBTITLE } from "@/lib/brand";

type Props = {
  cartCount?: number;
  showInstallButton?: boolean;
};

export function Header({ cartCount = 0, showInstallButton = false }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100/80 bg-white/95 shadow-[0_2px_12px_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-1 px-2.5 sm:h-16 sm:px-4">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-1 sm:gap-2">
            <img
              src={MART_ICON_SRC}
              alt=""
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-md object-contain sm:h-8 sm:w-8"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold leading-tight tracking-[-0.03em] text-emerald-800 sm:text-base">
                {MART_NAME}
              </p>
              <p className="text-[10px] sm:text-xs text-green-600 hidden sm:block">
                {MART_SUBTITLE}
              </p>
            </div>
          </Link>

          {showInstallButton && <PwaInstallButton variant="header" />}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/order-check"
            className="flex min-h-[42px] items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100 transition hover:bg-emerald-100 sm:min-h-[44px] sm:px-4 sm:text-sm"
          >
            📦 주문 확인
          </Link>

          <Link
            href="/cart"
            className="relative flex min-h-[42px] min-w-[42px] items-center justify-center gap-1 rounded-full bg-emerald-600 px-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:min-h-[44px] sm:gap-1.5 sm:px-4 sm:text-sm"
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
