import type { Metadata } from "next";
import { MART_NAME } from "@/lib/brand";

const ADMIN_APP_NAME = `${MART_NAME} 관리자`;
const ADMIN_MANIFEST_HREF = "/admin/manifest.webmanifest";

export const metadata: Metadata = {
  applicationName: ADMIN_APP_NAME,
  title: ADMIN_APP_NAME,
  manifest: ADMIN_MANIFEST_HREF,
  appleWebApp: {
    capable: true,
    title: ADMIN_APP_NAME,
    statusBarStyle: "default",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const syncAdminManifest = `
(() => {
  const manifestHref = ${JSON.stringify(ADMIN_MANIFEST_HREF)};
  const adminAppName = ${JSON.stringify(ADMIN_APP_NAME)};
  const manifestLinks = Array.from(document.head.querySelectorAll('link[rel="manifest"]'));
  const manifestLink = manifestLinks[0] || document.createElement("link");
  manifestLink.setAttribute("rel", "manifest");
  manifestLink.setAttribute("href", manifestHref);
  if (!manifestLink.parentNode) document.head.appendChild(manifestLink);
  manifestLinks.slice(1).forEach((link) => link.remove());

  const setMeta = (name, content) => {
    let meta = document.head.querySelector(\`meta[name="\${name}"]\`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  };

  setMeta("application-name", adminAppName);
  setMeta("apple-mobile-web-app-title", adminAppName);
})();
`;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950">
      <script dangerouslySetInnerHTML={{ __html: syncAdminManifest }} />
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
