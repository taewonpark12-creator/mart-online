import { cookies } from "next/headers";

const ADMIN_COOKIE = "mart_admin_session";
const ADMIN_LAST_LOGIN_COOKIE = "mart_admin_last_login";
const ADMIN_PASSWORD = "940326@@";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated";
}

export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
export const ADMIN_LAST_LOGIN_COOKIE_NAME = ADMIN_LAST_LOGIN_COOKIE;
