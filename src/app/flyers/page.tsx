"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { GoBackToShoppingButton } from "@/components/GoBackToShoppingButton";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
};

export default function FlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/flyers")
      .then((res) => res.json())
      .then((data) => {
        setFlyers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("전단지 로딩 오류:", error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    setFailedImageUrl(null);
  }, [flyers]);

  const currentFlyer = flyers[currentIndex];
  const currentImageUrl = currentFlyer?.imageUrl ?? "";
  const zoomUrl = currentImageUrl ? `/flyers/view?src=${encodeURIComponent(currentImageUrl)}` : "";

  const handlePrev = () => {
    setFailedImageUrl(null);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : flyers.length - 1));
  };

  const handleNext = () => {
    setFailedImageUrl(null);
    setCurrentIndex((prev) => (prev < flyers.length - 1 ? prev + 1 : 0));
  };

  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const handleSwipeMove = (moveEvent: TouchEvent | MouseEvent) => {
      const moveClientX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const diff = clientX - moveClientX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handlePrev();
        } else {
          handleNext();
        }
        document.removeEventListener("touchmove", handleSwipeMove);
        document.removeEventListener("mousemove", handleSwipeMove);
      }
    };

    document.addEventListener("touchmove", handleSwipeMove);
    document.addEventListener("mousemove", handleSwipeMove);

    const handleSwipeEnd = () => {
      document.removeEventListener("touchmove", handleSwipeMove);
      document.removeEventListener("mousemove", handleSwipeMove);
      document.removeEventListener("touchend", handleSwipeEnd);
      document.removeEventListener("mouseup", handleSwipeEnd);
    };

    document.addEventListener("touchend", handleSwipeEnd);
    document.addEventListener("mouseup", handleSwipeEnd);
  };

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">세일 전단</h1>
          <div className="flex items-center gap-2">
            {currentImageUrl && failedImageUrl !== currentImageUrl && (
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm"
              >
                원본 새 탭
              </a>
            )}
            <GoBackToShoppingButton />
          </div>
        </div>

        {/* 전단지 영역 */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
          <div className="relative w-full h-[70vh] sm:h-[80vh] bg-gray-100">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : flyers.length === 0 || !currentImageUrl ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>등록된 전단지가 없습니다.</p>
              </div>
            ) : failedImageUrl === currentImageUrl ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-gray-600">
                <p>전단지 이미지를 불러올 수 없습니다</p>
              </div>
            ) : (
              <>
                <div
                  className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                  onTouchStart={handleSwipeStart}
                  onMouseDown={handleSwipeStart}
                >
                  <a href={zoomUrl} className="flex h-full w-full items-center justify-center" aria-label="전단지 확대 보기">
                    <img
                      key={currentImageUrl}
                      src={currentImageUrl}
                      alt={`전단지 ${currentIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        console.error("[/flyers] Failed to load flyer image:", currentImageUrl);
                        setFailedImageUrl(currentImageUrl);
                      }}
                    />
                  </a>
                </div>

                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">
                  이미지를 누르면 확대됩니다
                </div>

                {/* 네비게이션 버튼 */}
                {flyers.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}

                {/* 페이지 인디케이터 */}
                {flyers.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {flyers.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setFailedImageUrl(null);
                          setCurrentIndex(index);
                        }}
                        className={`w-2 h-2 rounded-full transition ${
                          index === currentIndex ? "bg-green-600" : "bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
