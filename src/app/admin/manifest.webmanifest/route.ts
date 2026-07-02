import { MART_NAME } from "@/lib/brand";

const ADMIN_APP_NAME = `${MART_NAME} 관리자`;

export function GET() {
  const manifest = {
    name: ADMIN_APP_NAME,
    short_name: ADMIN_APP_NAME,
    description: `${ADMIN_APP_NAME} 주문관리`,
    start_url: "/admin/orders",
    scope: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
