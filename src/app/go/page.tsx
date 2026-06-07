"use client";

import { useEffect, useState } from "react";

const TARGET_URL = "https://lovemart.vercel.app/";

function isKakaoTalkInAppBrowser() {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("kakaotalk");
}

export default function GoPage() {
  const [isKakao, setIsKakao] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    const kakao = isKakaoTalkInAppBrowser();
    setIsKakao(kakao);

    if (!kakao) {
      // 일반 브라우저: 즉시 이동
      window.location.replace(TARGET_URL);
    } else {
      // 카카오 인앱: 안내 화면 표시
      setIsRedirecting(false);
    }
  }, []);

  // 일반 브라우저 이동 중 로딩 표시
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">이동 중입니다...</p>
        </div>
      </div>
    );
  }

  // 카카오 인앱: 안내 화면
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
  크롬, 네이버 등 브라우저에서<br />
  더 안정적으로 이용할 수 있습니다
        </h1>

        {/* 설명 */}
        <p className="text-lg text-gray-600 mb-8">
          우측 하단 (⋮) → "다른 브라우저로 열기"를 눌러주세요
        </p>

        {/* 브라우저로 열기 버튼 */}
        <button
          onClick={() => {
            window.location.href = TARGET_URL;
          }}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-5 px-6 rounded-xl transition-colors shadow-md active:scale-95 mb-4"
        >
          카카오톡으로 열기
        </button>

        
 
      </div>
    </div>
  );
}
