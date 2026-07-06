import { NextResponse, type NextRequest } from "next/server";

const LEGACY_HOST = "lovemart.vercel.app";
const CANONICAL_ORIGIN = "https://lovemart.kr";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0];

  if (host !== LEGACY_HOST || request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
  return NextResponse.redirect(redirectUrl, 308);
}

