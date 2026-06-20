"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Props = {
  children: ReactNode;
  className: string;
};

export function HorizontalScrollHint({ children, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    const nextProgress = maxScrollLeft > 0 ? (node.scrollLeft / maxScrollLeft) * 100 : 100;

    setProgress(Math.min(100, Math.max(0, nextProgress)));
    setCanScrollPrev(node.scrollLeft > 4);
    setCanScrollNext(node.scrollLeft < maxScrollLeft - 4);
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const node = scrollRef.current;
    if (!node) return;

    node.scrollBy({
      left: direction * node.clientWidth * 0.9,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = scrollRef.current;
    if (!node) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(node);

    return () => observer.disconnect();
  }, [updateScrollState, children]);

  return (
    <div>
      {canScrollNext && (
        <div className="mb-2 flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800 sm:text-base">
            상품을 옆으로 밀어보세요
            <span className="text-lg leading-none" aria-hidden>
              →
            </span>
          </span>
        </div>
      )}

      <div className="group relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className={`${className} pr-8 scrollbar-thin`}
        >
          {children}
        </div>

        {canScrollPrev && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white via-white/85 to-transparent" />
        )}
        {canScrollNext && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/90 to-transparent" />
        )}

        {canScrollPrev && (
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            className="hidden sm:flex absolute left-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-lg ring-1 ring-gray-200 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="이전 상품 보기"
          >
            &lt;
          </button>
        )}
        {canScrollNext && (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            className="hidden sm:flex absolute right-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-lg ring-1 ring-gray-200 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label="다음 상품 보기"
          >
            &gt;
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-200"
            style={{ width: `${canScrollNext || canScrollPrev ? Math.max(progress, 8) : 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
