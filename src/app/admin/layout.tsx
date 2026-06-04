import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "한사랑마트 관리자",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
