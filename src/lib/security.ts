import { NextRequest } from "next/server";

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, 1000);
}

export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, "");
  return /^(01[016789]\d{7,8}|0[2-9]\d{7,9})$/.test(cleaned);
}

export function validateName(name: string): boolean {
  const trimmed = sanitizeInput(name);
  return trimmed.length >= 1 && trimmed.length <= 50 && !/[<>]/.test(trimmed);
}

export function validateAddress(address: string): boolean {
  const trimmed = sanitizeInput(address);
  return trimmed.length >= 5 && trimmed.length <= 200;
}

export function validateAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 10000000;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}

export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

export function maskSensitiveInfo(value: string, visibleChars: number = 2): string {
  if (!value || value.length <= visibleChars) {
    return value;
  }
  return value.substring(0, visibleChars) + "*".repeat(value.length - visibleChars);
}

export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    return cleaned.substring(0, 3) + "-***-" + cleaned.substring(7);
  }
  return maskSensitiveInfo(cleaned, 3);
}
