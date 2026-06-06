"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TARGET_URL = "https://lovemart.vercel.app/";

export default function GoPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace(TARGET_URL);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleManualRedirect = () => {
    router.replace(TARGET_URL);
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
        <p className="text-lg text-gray-600 mb-2">
          이동 중입니다
        </p>
        <p className="text-sm text-gray-500 mb-8">
          {countdown > 0 ? `${countdown}초 후 자동 이동` : "이동 중..."}
        </p>

        {/* 수동 이동 버튼 */}
        <button
          onClick={handleManualRedirect}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-4 px-6 rounded-xl transition-colors shadow-md active:scale-95"
        >
          지금 바로 이동
        </button>

        {/* 추가 안내 */}
        <p className="text-xs text-gray-400 mt-6">
          더 나은 서비스 이용을 위해 브라우저로 이동합니다
        </p>
      </div>
    </div>
  );
}
