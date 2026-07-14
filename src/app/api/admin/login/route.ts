import { NextRequest, NextResponse } from "next/server";
import {
  isAdminPasswordConfigured,
  verifyAdminPassword,
  ADMIN_COOKIE_NAME,
  ADMIN_LAST_LOGIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        { error: "관리자 비밀번호가 설정되어 있지 않습니다." },
        { status: 503 },
      );
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다. 다시 시도해주세요." },
        { status: 401 },
      );
    }

    const loginAt = new Date().toISOString();
    const res = NextResponse.json({ success: true, lastLoginAt: loginAt });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    };

    res.cookies.set(ADMIN_COOKIE_NAME, "authenticated", cookieOptions);
    res.cookies.set(ADMIN_LAST_LOGIN_COOKIE_NAME, loginAt, cookieOptions);

    return res;
  } catch (error) {
    console.error("[POST /api/admin/login]", error);
    return NextResponse.json(
      { error: "로그인 요청을 처리하지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  res.cookies.set(ADMIN_LAST_LOGIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
