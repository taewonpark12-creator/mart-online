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
  const [loading, setLoading] = useState(true);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

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
    setFailedImageUrls(new Set());
  }, [flyers]);

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">세일 전단</h1>
          <GoBackToShoppingButton />
        </div>

        {/* 전단지 영역 */}
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center rounded-2xl bg-white shadow-sm sm:rounded-3xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : flyers.length === 0 ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm sm:rounded-3xl">
            <p>등록된 전단지가 없습니다.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-4">
            {flyers.map((flyer, index) => {
              const imageUrl = flyer.imageUrl;
              const zoomUrl = `/flyers/view?src=${encodeURIComponent(imageUrl)}`;
              const failed = failedImageUrls.has(imageUrl);

              return (
                <section key={flyer.id} className="w-full overflow-hidden rounded-2xl bg-white shadow-sm">
                  {failed ? (
                    <div className="flex min-h-48 w-full items-center justify-center px-4 text-center text-gray-600">
                      <p>전단지 이미지를 불러올 수 없습니다</p>
                    </div>
                  ) : (
                    <a href={zoomUrl} className="block w-full" aria-label={`전단지 ${index + 1} 확대 보기`}>
                      <img
                        src={imageUrl}
                        alt={`전단지 ${index + 1}`}
                        className="block h-auto w-full object-contain"
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          console.error("[/flyers] Failed to load flyer image:", imageUrl);
                          setFailedImageUrls((current) => new Set(current).add(imageUrl));
                        }}
                      />
                    </a>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
