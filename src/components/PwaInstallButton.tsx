"use client";

import { useEffect, useState } from "react";

const NEW_BADGE_KEY = "mart_pwa_install_button_seen";
const INSTALLED_KEY = "mart_pwa_installed";
const FALLBACK_MESSAGE = "Chrome 또는 Safari에서 열고 홈 화면에 추가해 주세요";

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
  return /KAKAOTALK/i.test(window.navigator.userAgent);
}

export function PwaInstallButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isStandaloneMode() || window.localStorage.getItem(INSTALLED_KEY) === "1") {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    const hasSeenNewBadge = window.localStorage.getItem(NEW_BADGE_KEY) === "1";
    setShowNewBadge(!hasSeenNewBadge);
    if (!hasSeenNewBadge) {
      window.localStorage.setItem(NEW_BADGE_KEY, "1");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The install button still works as a manual guide when SW registration is unavailable.
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsVisible(!isStandaloneMode());
    };

    const handleAppInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setInstallPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleClick = async () => {
    if (isStandaloneMode()) {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setIsVisible(false);
      return;
    }

    if (!installPrompt || isKakaoInAppBrowser()) {
      setNotice(FALLBACK_MESSAGE);
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="relative mb-2 flex justify-end sm:mb-3">
      <button
        type="button"
        onClick={handleClick}
        className="relative rounded-full border border-emerald-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:px-3 sm:text-xs"
        aria-label="홈 화면에 추가"
      >
        📱 홈 추가
        {showNewBadge && (
          <span className="absolute -right-1.5 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black leading-none text-white shadow-sm">
            NEW
          </span>
        )}
      </button>

      {notice && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold leading-snug text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
