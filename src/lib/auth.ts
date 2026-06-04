import { cookies } from "next/headers";

const ADMIN_COOKIE = "mart_admin_session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated";
}

export function verifyAdminPassword(password: string): boolean {
  return password === (process.env.ADMIN_PASSWORD ?? "admin1234");
}

export const ADMIN_COOKIE_NAME = ADMIN_COOKIE;
