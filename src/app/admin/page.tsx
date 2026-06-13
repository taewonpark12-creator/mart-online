"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AuthCheckResponse = {
  authenticated?: boolean;
  lastLoginAt?: string | null;
};

type LoginResponse = {
  success?: boolean;
  error?: string;
  lastLoginAt?: string;
};

function formatLoginTime(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SessionVerificationPanel() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden bg-gray-950 p-8 text-white lg:block">
            <div className="h-3 w-32 animate-pulse rounded bg-white/20" />
            <div className="mt-8 h-10 w-72 animate-pulse rounded bg-white/20" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="mt-12 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-xl bg-white/10" />
              ))}
            </div>
          </div>
          <div className="p-8">
            <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
            <div className="mt-5 h-8 w-56 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="mt-8 h-12 w-full animate-pulse rounded-xl bg-gray-100" />
            <p className="mt-5 text-center text-xs font-semibold text-gray-500">
              관리자 세션을 확인하는 중입니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AccessBadge({
  tone,
  label,
  detail,
}: {
  tone: "success" | "warning" | "neutral";
  label: string;
  detail: string;
}) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-gray-200 bg-gray-50 text-gray-700",
  }[tone];

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">{label}</p>
        <span className="h-2 w-2 rounded-full bg-current" />
      </div>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [sessionCheckedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const res = await fetch("/api/admin/auth", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as AuthCheckResponse;
          setLastLoginAt(data.lastLoginAt ?? null);
          hasRedirectedRef.current = true;
          router.replace("/admin/dashboard");
          return;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("[admin/login] session check failed", err);
        }
      } finally {
        if (!hasRedirectedRef.current) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();
    return () => controller.abort();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setError("관리자 비밀번호를 입력하세요.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPassword }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginResponse;

      if (!res.ok) {
        setError(data.error ?? "비밀번호가 맞지 않습니다. 다시 입력하세요.");
        return;
      }

      setLastLoginAt(data.lastLoginAt ?? new Date().toISOString());
      hasRedirectedRef.current = true;
      router.push("/admin/dashboard");
    } catch (err) {
      console.error("[admin/login] login failed", err);
      setError("접속 요청을 처리하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return <SessionVerificationPanel />;
  }

  return (
    <div className="min-h-screen px-4 py-8 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-stretch overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden bg-gray-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                  Admin Operations Gateway
                </p>
                <h1 className="mt-5 text-4xl font-black leading-tight">
                  Mart Online
                  <span className="block text-gray-300">Control Platform</span>
                </h1>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-gray-300">
                SYSTEM READY
              </div>
            </div>

            <p className="mt-5 max-w-xl text-sm leading-6 text-gray-300">
              주문 처리, 상품 운영, 전단 노출을 하나의 관리자 플랫폼에서 빠르게 점검하고 실행합니다.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["Orders", "실시간 주문 큐", "대기 주문 감지"],
                ["Products", "상품 상태 제어", "노출 태그 관리"],
                ["Flyers", "전단 운영", "고객 화면 반영"],
              ].map(([title, metric, detail]) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-3 text-lg font-black text-emerald-300">{metric}</p>
                  <p className="mt-1 text-xs text-gray-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
              Access Monitor
            </p>
            <div className="grid grid-cols-2 gap-3">
              <AccessBadge
                tone={lastLoginAt ? "success" : "neutral"}
                label="Last Success"
                detail={formatLoginTime(lastLoginAt)}
              />
              <AccessBadge
                tone={error ? "warning" : "success"}
                label={error ? "Action Required" : "Gateway Stable"}
                detail={error ? "입력값을 확인하세요." : `검증 ${formatLoginTime(sessionCheckedAt)}`}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                  Secure Entry
                </p>
                <h2 className="mt-2 text-3xl font-black text-gray-950">관리자 로그인</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gray-950 text-sm font-black text-white">
                HM
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">
              인증이 완료되면 운영 대시보드로 이동합니다. 세션 확인과 로그인 요청은 보안 API를 통해 처리됩니다.
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <AccessBadge tone="neutral" label="Session Check" detail="완료, 로그인 필요" />
            <AccessBadge tone={lastLoginAt ? "success" : "neutral"} label="Recent Login" detail={formatLoginTime(lastLoginAt)} />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-800">
                관리자 비밀번호
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                placeholder="비밀번호 입력"
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gray-950 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {submitting ? "인증 중..." : "운영 콘솔 접속"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5 text-xs text-gray-500">
            <span>비밀번호는 서버에서만 검증됩니다.</span>
            <a href="/" className="font-bold text-emerald-700 hover:underline">
              고객 페이지
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
