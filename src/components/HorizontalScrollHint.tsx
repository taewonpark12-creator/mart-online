"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Props = {
  children: ReactNode;
  className: string;
};

const SCROLL_HINT_STORAGE_KEY = "homeProductScrollHintSeen";
let scrollHintSessionQueued = false;

export function HorizontalScrollHint({ children, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hintTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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

  const clearHintTimers = useCallback(() => {
    hintTimersRef.current.forEach((timer) => clearTimeout(timer));
    hintTimersRef.current = [];
  }, []);

  const markHintSeen = useCallback(() => {
    clearHintTimers();
    try {
      window.localStorage.setItem(SCROLL_HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, [clearHintTimers]);

  useEffect(() => {
    updateScrollState();
    const node = scrollRef.current;
    if (!node) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(node);

    return () => observer.disconnect();
  }, [updateScrollState, children]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || scrollHintSessionQueued) return;

    try {
      if (window.localStorage.getItem(SCROLL_HINT_STORAGE_KEY) === "1") return;
    } catch {
      return;
    }

    if (node.scrollWidth <= node.clientWidth + 8) return;

    scrollHintSessionQueued = true;
    const startTimer = setTimeout(() => {
      node.scrollTo({ left: 18, behavior: "smooth" });

      const backTimer = setTimeout(() => {
        node.scrollTo({ left: 0, behavior: "smooth" });
      }, 260);

      const doneTimer = setTimeout(() => {
        markHintSeen();
      }, 700);

      hintTimersRef.current.push(backTimer, doneTimer);
    }, 450);

    hintTimersRef.current.push(startTimer);
    return clearHintTimers;
  }, [children, clearHintTimers, markHintSeen]);

  return (
    <div>
      <div className="group relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          onPointerDown={markHintSeen}
          onTouchStart={markHintSeen}
          onWheel={markHintSeen}
          className={`${className} pr-4 scrollbar-thin`}
        >
          {children}
        </div>

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
