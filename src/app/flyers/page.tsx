"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { GoBackToShoppingButton } from "@/components/GoBackToShoppingButton";
import { STORE } from "@/lib/store";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
};

type FlyerAnnouncement = {
  id: string;
  title: string;
  content: string;
  showOnlineOrder?: boolean;
  showPhoneOrder?: boolean;
};

function telHref(phone: string) {
  return `tel:${phone.replace(/\D/g, "")}`;
}

export default function FlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [announcement, setAnnouncement] = useState<FlyerAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [flyersError, setFlyersError] = useState(false);
  const [announcementError, setAnnouncementError] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const showOnlineOrder = announcement?.showOnlineOrder ?? true;
  const showPhoneOrder = announcement?.showPhoneOrder ?? true;
  const showOrderGuide = Boolean(announcement && (showOnlineOrder || showPhoneOrder));

  useEffect(() => {
    setLoading(true);
    setFlyersError(false);
    setAnnouncementError(false);

    Promise.allSettled([
      fetch("/api/flyers").then(async (res) => {
        if (!res.ok) {
          throw new Error(`전단지 조회 실패 (${res.status})`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("전단지 응답 형식이 올바르지 않습니다.");
        }

        return data as Flyer[];
      }),
      fetch("/api/flyers/announcement").then(async (res) => {
        if (!res.ok) {
          throw new Error(`전단지 공지 조회 실패 (${res.status})`);
        }

        const data = await res.json();
        return (data?.announcement ?? null) as FlyerAnnouncement | null;
      }),
    ])
      .then(([flyerResult, announcementResult]) => {
        if (flyerResult.status === "fulfilled") {
          setFlyers(flyerResult.value);
        } else {
          console.error("전단지 로딩 오류:", flyerResult.reason);
          setFlyers([]);
          setFlyersError(true);
        }

        if (announcementResult.status === "fulfilled") {
          setAnnouncement(announcementResult.value);
        } else {
          console.error("전단지 공지 로딩 오류:", announcementResult.reason);
          setAnnouncement(null);
          setAnnouncementError(true);
        }

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
        ) : flyersError ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-white px-4 text-center text-gray-600 shadow-sm sm:rounded-3xl">
            <p className="whitespace-pre-line leading-7">
              {"전단 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요."}
            </p>
          </div>
        ) : flyers.length === 0 && !announcement ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm sm:rounded-3xl">
            <p>등록된 전단지가 없습니다.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-4">
            {!announcementError && announcement && (
              <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                <h2 className="break-keep text-lg font-extrabold leading-7 text-emerald-900 sm:text-xl">
                  {announcement.title}
                </h2>
                <p className="mt-2 whitespace-pre-line break-words text-base font-medium leading-7 text-gray-800">
                  {announcement.content}
                </p>
                {showOrderGuide && (
                  <div className="mt-4 space-y-3">
                    {showOnlineOrder && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                        <h3 className="text-base font-extrabold leading-6 text-green-900">
                          온라인으로 편하게 주문하세요
                        </h3>
                        <p className="mt-1 break-keep text-sm font-medium leading-6 text-green-800">
                          상품을 직접 확인하고 휴대폰으로 바로 주문할 수 있습니다.
                        </p>
                        <a
                          href="/"
                          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-green-700"
                        >
                          온라인 주문하기
                        </a>
                      </div>
                    )}

                    {showPhoneOrder && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                        <h3 className="text-base font-extrabold leading-6 text-gray-900">
                          전화주문도 가능합니다.
                        </h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <a
                            href={telHref(STORE.phone)}
                            className="flex min-h-12 items-center justify-center rounded-xl bg-white px-4 py-3 text-lg font-extrabold text-gray-900 shadow-sm"
                          >
                            {STORE.phone}
                          </a>
                          <a
                            href={telHref(STORE.phoneMobile)}
                            className="flex min-h-12 items-center justify-center rounded-xl bg-white px-4 py-3 text-lg font-extrabold text-gray-900 shadow-sm"
                          >
                            {STORE.phoneMobile}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
            {flyers.length > 0 && (
              <div className="flex justify-center pt-3 sm:pt-4">
                <GoBackToShoppingButton />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
