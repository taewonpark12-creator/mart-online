"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { GoBackToShoppingButton } from "@/components/GoBackToShoppingButton";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
};

type FlyerAnnouncement = {
  id: string;
  title: string;
  content: string;
};

export default function FlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [announcement, setAnnouncement] = useState<FlyerAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/flyers", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/flyers/announcement", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([flyerData, announcementData]) => {
        setFlyers(Array.isArray(flyerData) ? flyerData : []);
        setAnnouncement(announcementData?.announcement ?? null);
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
        ) : flyers.length === 0 && !announcement ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm sm:rounded-3xl">
            <p>등록된 전단지가 없습니다.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-4">
            {announcement && (
              <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                <h2 className="break-keep text-lg font-extrabold leading-7 text-emerald-900 sm:text-xl">
                  {announcement.title}
                </h2>
                <p className="mt-2 whitespace-pre-line break-words text-base font-medium leading-7 text-gray-800">
                  {announcement.content}
                </p>
              </section>
            )}
            {flyers.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm sm:rounded-3xl">
                <p>등록된 전단지가 없습니다.</p>
              </div>
            ) : null}
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
