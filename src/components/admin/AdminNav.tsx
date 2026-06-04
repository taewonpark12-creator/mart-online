"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin/dashboard", label: "대시보드", icon: "📊" },
  { href: "/admin/orders", label: "주문 관리", icon: "📋" },
  { href: "/admin/products", label: "상품 관리", icon: "📦" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin");
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xl mr-2">🏪</span>
          <span className="font-bold text-gray-800 text-sm hidden sm:block">한사랑마트 관리</span>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-green-100 text-green-800"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-gray-400 hover:text-green-600">
            고객 페이지 →
          </a>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}
