"use client";

import { useState } from "react";

type Props = {
  onOpen: () => void;
};

export function FlyerBanner({ onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      className="w-full bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl sm:text-3xl">📢</span>
          <div className="text-left">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">이번주 세일 전단</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">행사상품을 확인해보세요</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm sm:text-base group-hover:translate-x-1 transition-transform">
          <span className="hidden sm:inline">전단지 보기</span>
          <span className="sm:hidden">보기</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
