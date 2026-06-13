import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "한사랑마트 관리자",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-950">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0)_260px)]" />
      <div className="relative min-h-screen" data-admin-platform-shell>
        <div className="sr-only" data-admin-sidebar-anchor />
        <div className="sr-only" data-admin-topbar-anchor />
        <div className="min-h-screen" data-admin-content-layer>
          {children}
        </div>
      </div>
    </div>
  );
}
