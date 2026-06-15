"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

type Stats = {
  pendingOrders: number;
  todayOrders: number;
  totalProducts: number;
  lowStock: number;
  salesData: Array<{ date: string; sales: number; orderCount: number }>;
  popularProducts: Array<{ id: string; name: string; quantity: number }>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");

  const router = useRouter();
  const pathname = usePathname();

  const redirectToAdminLogin = useCallback((details?: {
    reason?: string;
    isAuthenticated?: boolean;
    loading?: boolean;
  }) => {
    console.log("[ADMIN REDIRECT]", {
      source: "/admin/dashboard",
      target: "/admin",
      reason: details?.reason ?? "auth_failed",
      pathname,
      isAuthenticated: details?.isAuthenticated,
      loading: details?.loading,
      timestamp: Date.now(),
    });
    if (pathname !== "/admin") {
      console.log("[REDIRECT EXECUTE]", {
        from: pathname,
        to: "/admin",
        timestamp: Date.now(),
      });
      router.replace("/admin");
    }
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth", { cache: "no-store" });
        console.log("[AUTH STATE]", {
          source: "/admin/dashboard",
          pathname,
          loading: checkingAuth,
          authenticated: res.ok,
          tokenExists: "httpOnly_unreadable",
          sessionExists: res.ok,
          status: res.status,
          timestamp: Date.now(),
        });
        if (!res.ok) {
          if (!cancelled) {
            setIsAuthenticated(false);
          }
          redirectToAdminLogin({
            reason: "auth_check_non_ok",
            isAuthenticated: false,
            loading: checkingAuth,
          });
          return;
        }
        if (!cancelled) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("[admin/dashboard] auth check failed", error);
        if (!cancelled) {
          setIsAuthenticated(false);
        }
        redirectToAdminLogin({
          reason: "auth_check_error",
          isAuthenticated: false,
          loading: checkingAuth,
        });
        return;
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [redirectToAdminLogin]);

  const fetchStats = useCallback(async () => {
    if (checkingAuth || !isAuthenticated) return;

    setLoading(true);
    setStatsError("");

    try {
      const res = await fetch(`/api/admin/stats?period=${period}`);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.log("[AUTH STATE]", {
            source: "/admin/dashboard",
            pathname,
            loading,
            authenticated: false,
            tokenExists: "httpOnly_unreadable",
            sessionExists: false,
            status: res.status,
            timestamp: Date.now(),
          });
          setIsAuthenticated(false);
          redirectToAdminLogin({
            reason: "stats_auth_failed",
            isAuthenticated: false,
            loading,
          });
          return;
        }

        setStatsError("대시보드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error(error);
      setStatsError("대시보드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, [checkingAuth, isAuthenticated, period, redirectToAdminLogin]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cards = stats
    ? [
        {
          label: "접수 대기 주문",
          value: stats.pendingOrders,
          icon: "🔔",
          color: "bg-amber-50 border-amber-200 text-amber-800",
        },
        {
          label: "오늘 주문",
          value: stats.todayOrders,
          icon: "📅",
          color: "bg-blue-50 border-blue-200 text-blue-800",
        },
        {
          label: "판매 중 상품",
          value: stats.totalProducts,
          icon: "📦",
          color: "bg-green-50 border-green-200 text-green-800",
        },
        {
          label: "재고 부족 (10개 이하)",
          value: stats.lowStock,
          icon: "⚠️",
          color: "bg-red-50 border-red-200 text-red-700",
        },
      ]
    : [];

  const totalSales =
    stats?.salesData.reduce((sum, item) => sum + item.sales, 0) || 0;

  const totalOrders =
    stats?.salesData.reduce((sum, item) => sum + item.orderCount, 0) || 0;

  const maxSales =
    stats?.salesData.length
      ? Math.max(...stats.salesData.map((item) => item.sales))
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

        {statsError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {statsError}
          </div>
        )}

        {checkingAuth || (!stats && !statsError) ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl h-28 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-5 ${card.color}`}
              >
                <span className="text-2xl">{card.icon}</span>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
                <p className="text-sm mt-1 opacity-80">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 매출 차트 */}
        <div className="mt-8 bg-white rounded-2xl border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">매출 추이</h2>

            <div className="flex gap-2">
              <button
                onClick={() => setPeriod("daily")}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  period === "daily"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                최근 7일
              </button>

              <button
                onClick={() => setPeriod("monthly")}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  period === "monthly"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                최근 30일
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />
          ) : stats?.salesData && stats.salesData.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>총 매출: {totalSales.toLocaleString()}원</span>
                <span>총 주문: {totalOrders}건</span>
              </div>

              <div className="h-64 flex items-end gap-1">
                {stats.salesData.map((item) => {
                  const height =
                    maxSales > 0 ? (item.sales / maxSales) * 100 : 0;

                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full bg-green-500 rounded-t hover:bg-green-600 transition cursor-pointer relative group"
                        style={{ height: `${Math.max(height, 1)}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          {item.sales.toLocaleString()}원 ({item.orderCount}건)
                        </div>
                      </div>

                      <span className="text-xs text-gray-500 truncate w-full text-center">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              데이터가 없습니다.
            </p>
          )}
        </div>

        {/* 인기 상품 */}
        <div className="mt-8 bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            인기 상품 (최근 30일)
          </h2>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse bg-gray-100 rounded-lg"
                />
              ))}
            </div>
          ) : stats?.popularProducts &&
            stats.popularProducts.length > 0 ? (
            <div className="space-y-3">
              {stats.popularProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-full font-bold text-sm">
                    {index + 1}
                  </span>

                  <span className="flex-1 font-medium text-gray-800">
                    {product.name}
                  </span>

                  <span className="text-sm text-gray-600">
                    {product.quantity}개 판매
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              데이터가 없습니다.
            </p>
          )}
        </div>

        {/* 빠른 안내 */}
        <div className="mt-8 bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-3">
            빠른 안내
          </h2>

          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              • <strong>주문 관리</strong>에서 신규 주문을 확인하고 상태를
              변경하세요.
            </li>
            <li>
              • 주문 상태: 접수대기 → 주문승인 → 배달완료
            </li>
            <li>
              • <strong>상품 관리</strong>에서 재고와 가격을
              업데이트하세요.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
