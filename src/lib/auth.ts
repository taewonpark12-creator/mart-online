import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "mart_admin_session";
const ADMIN_LAST_LOGIN_COOKIE = "mart_admin_last_login";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AdminSessionPayload = {
  v: 1;
  exp: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  if (!ADMIN_SESSION_SECRET) return null;
  return createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminSessionSecretConfigured(): boolean {
  return Boolean(ADMIN_SESSION_SECRET);
}

export function createAdminSessionCookieValue(now = new Date()): string | null {
  const expiresAt = now.getTime() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  const payload: AdminSessionPayload = {
    v: 1,
    exp: expiresAt,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  if (!signature) return null;

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionCookieValue(value: string | undefined, now = new Date()): boolean {
  if (!value || !ADMIN_SESSION_SECRET) return false;

  const [encodedPayload, signature, extra] = value.split(".");
  if (!encodedPayload || !signature || extra !== undefined) return false;

  const expectedSignature = signPayload(encodedPayload);
  if (!expectedSignature || !safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminSessionPayload>;
    return payload.v === 1 && typeof payload.exp === "number" && payload.exp > now.getTime();
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSessionCookieValue(cookieStore.get(ADMIN_COOKIE)?.value);
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
