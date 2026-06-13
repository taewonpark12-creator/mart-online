import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_LAST_LOGIN_COOKIE_NAME,
  isAdminAuthenticated,
} from "@/lib/auth";

export async function GET() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const cookieStore = await cookies();
  const lastLoginAt = cookieStore.get(ADMIN_LAST_LOGIN_COOKIE_NAME)?.value ?? null;

  return NextResponse.json({
    authenticated: true,
    lastLoginAt,
  });
}
