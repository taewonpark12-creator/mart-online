"use client";

import { useEffect, useState } from "react";

const IOS_SAFARI_MESSAGE = "아이폰에서는 하단 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택해주세요.";
const FALLBACK_MESSAGE = "Chrome 또는 Safari에서 열고 홈 화면에 추가해 주세요";

type Props = {
  variant?: "default" | "header";
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isKakaoInAppBrowser() {
  return /KAKAOTALK/i.test(getUserAgent());
}

function getUserAgent() {
  return window.navigator.userAgent;
}

function isIOSDevice() {
  const navigatorWithTouch = window.navigator as Navigator & { maxTouchPoints?: number };

  return (
    /iPad|iPhone|iPod/i.test(getUserAgent()) ||
    (window.navigator.platform === "MacIntel" && Number(navigatorWithTouch.maxTouchPoints) > 1)
  );
}

function isNaverInAppBrowser() {
  return /NAVER|NAVER\(inapp/i.test(getUserAgent());
}

function isIOSChrome() {
  return isIOSDevice() && /CriOS/i.test(getUserAgent());
}

function isIOSSafari() {
  const userAgent = getUserAgent();
  const isSafari = /Safari/i.test(userAgent);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  const isInAppBrowser =
    isKakaoInAppBrowser() ||
    isNaverInAppBrowser() ||
    /DaumApps|FBAN|FBAV|Instagram|Line/i.test(userAgent);

  return isIOSDevice() && isSafari && !isOtherIOSBrowser && !isInAppBrowser;
}

export function PwaInstallButton({ variant = "default" }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const updateVisibilityByDisplayMode = () => setIsVisible(!isStandaloneMode());
    updateVisibilityByDisplayMode();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The install button still works as a manual guide when SW registration is unavailable.
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      updateVisibilityByDisplayMode();
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsVisible(false);
    };

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayModeQuery.addEventListener("change", updateVisibilityByDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModeQuery.removeEventListener("change", updateVisibilityByDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleClick = async () => {
    if (isStandaloneMode()) {
      setIsVisible(false);
      return;
    }

    if (isIOSSafari()) {
      setNotice(IOS_SAFARI_MESSAGE);
      return;
    }

    if (!installPrompt || isKakaoInAppBrowser() || isNaverInAppBrowser() || isIOSChrome()) {
      setNotice(FALLBACK_MESSAGE);
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  };

  if (!isVisible) {
    return null;
  }

  const isHeader = variant === "header";

  return (
    <div className={isHeader ? "relative shrink-0" : "relative mb-2 flex justify-end sm:mb-3"}>
      <button
        type="button"
        onClick={handleClick}
        className={
          isHeader
            ? "relative rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold leading-none text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            : "relative rounded-full border border-emerald-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:px-3 sm:text-xs"
        }
        aria-label="홈 화면에 추가"
      >
        ➕ 홈 추가
      </button>

      {notice && (
        <div className="absolute left-0 top-full z-40 mt-2 w-56 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold leading-snug text-white shadow-lg sm:left-auto sm:right-0">
          {notice}
        </div>
      )}
    </div>
  );
}
