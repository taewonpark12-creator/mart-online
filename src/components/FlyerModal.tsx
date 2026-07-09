"use client";

import { useState, useEffect } from "react";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function FlyerModal({ isOpen, onClose }: Props) {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/flyers")
        .then((res) => res.json())
        .then((data) => {
          setFlyers(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("전단지 로딩 오류:", error);
          setLoading(false);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : flyers.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < flyers.length - 1 ? prev + 1 : 0));
  };

  const currentImageUrl = flyers[currentIndex]?.imageUrl ?? "";
  const zoomUrl = currentImageUrl ? `/flyers/view?src=${encodeURIComponent(currentImageUrl)}` : "";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-4xl h-full sm:h-[90vh] bg-white rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h2 className="font-bold text-gray-900 text-lg">세일 전단</h2>
          <div className="flex items-center gap-2">
            {currentImageUrl && (
              <a
                href={zoomUrl}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700"
              >
                확대
              </a>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* 전단지 영역 */}
        <div className="flex-1 relative bg-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : flyers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>등록된 전단지가 없습니다.</p>
            </div>
          ) : (
            <>
              <div
                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                onTouchStart={handleSwipeStart}
                onMouseDown={handleSwipeStart}
              >
                <img
                  src={currentImageUrl}
                  alt={`전단지 ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
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
                      onClick={() => setCurrentIndex(index)}
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
  );
}
