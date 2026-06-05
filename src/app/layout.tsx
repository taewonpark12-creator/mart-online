import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/contexts/CartContext";

export const metadata: Metadata = {
  title: "한사랑마트 - 온라인 배달 주문",
  description: "한사랑마트 온라인 주문 및 배달 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
