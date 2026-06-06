"use client";

import { useState } from "react";

const TARGET_URL = "https://lovemart.vercel.app/";

export default function GoPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleRedirect = () => {
    setIsRedirecting(true);
    window.location.href = TARGET_URL;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* 로딩 스피너 */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        </div>

        {/* 안내 문구 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          잠시만 기다려 주세요
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          브라우저로 이동합니다
        </p>

        {/* 브라우저로 열기 버튼 */}
        <button
          onClick={handleRedirect}
          disabled={isRedirecting}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xl font-bold py-5 px-6 rounded-xl transition-colors shadow-md active:scale-95 disabled:cursor-not-allowed"
        >
          {isRedirecting ? "이동 중..." : "브라우저로 열기"}
        </button>

        {/* 추가 안내 */}
        <p className="text-xs text-gray-400 mt-6">
          더 나은 서비스 이용을 위해 브라우저로 이동합니다
        </p>
      </div>
    </div>
  );
}
