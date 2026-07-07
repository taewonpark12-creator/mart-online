"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function isSafeFlyerImageUrl(src: string) {
  return src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://");
}

function FlyerImageViewerContent() {
  const searchParams = useSearchParams();
  const src = searchParams.get("src")?.trim() ?? "";
  const imageUrl = isSafeFlyerImageUrl(src) ? src : "";

  return (
    <main className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-3 py-2 backdrop-blur">
        <a href="/flyers" className="rounded-lg px-3 py-2 text-sm font-bold text-gray-700">
          닫기
        </a>
        <p className="text-xs font-semibold text-gray-500">손가락으로 확대해서 볼 수 있습니다</p>
      </div>

      {imageUrl ? (
        <div className="mx-auto w-full max-w-none">
          <img
            src={imageUrl}
            alt="전단지 확대 이미지"
            className="block h-auto w-full select-auto"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="flex min-h-[70vh] items-center justify-center px-4 text-center text-gray-500">
          전단지 이미지를 불러올 수 없습니다.
        </div>
      )}
    </main>
  );
}

export default function FlyerImageViewerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <FlyerImageViewerContent />
    </Suspense>
  );
}

