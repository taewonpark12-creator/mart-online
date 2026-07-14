import { cookies } from "next/headers";

const ADMIN_COOKIE = "mart_admin_session";
const ADMIN_LAST_LOGIN_COOKIE = "mart_admin_last_login";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated";
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) {
    return false;
  }

  return password === ADMIN_PASSWORD;
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
export const ADMIN_LAST_LOGIN_COOKIE_NAME = ADMIN_LAST_LOGIN_COOKIE;
