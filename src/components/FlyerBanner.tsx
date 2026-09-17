export function FlyerBanner() {
  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-lime-50 px-3.5 py-3 shadow-[0_6px_20px_-16px_rgba(5,150,105,0.65)] transition duration-200 hover:border-emerald-300 hover:shadow-[0_8px_24px_-16px_rgba(5,150,105,0.7)] sm:px-4 sm:py-3.5">
      <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-100/60" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm sm:h-11 sm:w-11" aria-hidden>
            <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 11 18-5v12L3 14v-3Z" />
              <path d="M11.6 15.9 13 21H8l-1.3-6" />
            </svg>
          </span>
          <div className="min-w-0 text-left">
            <h3 className="truncate text-sm font-extrabold tracking-[-0.02em] text-slate-900 sm:text-base">이번 주 세일 전단</h3>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500 sm:text-sm">이번 주 행사상품을 한눈에 확인하세요</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/90 py-1.5 pl-2.5 pr-1.5 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white sm:gap-1.5 sm:pl-3 sm:text-sm">
          <span className="hidden min-[360px]:inline">전단 보기</span>
          <span className="min-[360px]:hidden">보기</span>
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
