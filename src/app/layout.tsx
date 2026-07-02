import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/contexts/CartContext";
import { MART_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  applicationName: MART_NAME,
  title: MART_NAME,
  description: `${MART_NAME} 온라인 주문 및 배달 서비스`,
  appleWebApp: {
    capable: true,
    title: MART_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    siteName: MART_NAME,
    title: MART_NAME,
    description: `${MART_NAME} 온라인 주문 및 배달 서비스`,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
