import { NextRequest } from "next/server";

// XSS 방지를 위한 HTML 이스케이프
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// SQL Injection 방지를 위한 입력 검증 (Prisma가 이미 처리하지만 추가 보안)
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[;'"\\]/g, "");
}

// 전화번호 검증
export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, "");
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// 이름 검증 (한글, 영문만 허용)
export function validateName(name: string): boolean {
  const koreanEnglishRegex = /^[가-힣a-zA-Z\s]+$/;
  return koreanEnglishRegex.test(name.trim()) && name.trim().length >= 1;
}

// 주소 검증
export function validateAddress(address: string): boolean {
  return address.trim().length >= 5;
}

// 금액 검증
export function validateAmount(amount: number): boolean {
  return amount > 0 && amount <= 10000000; // 최대 1000만원
}

// IP 주소 가져오기
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// User-Agent 가져오기
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}

// 안전한 헤더 설정
export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

// 민감 정보 마스킹
export function maskSensitiveInfo(value: string, visibleChars: number = 2): string {
  if (!value || value.length <= visibleChars) {
    return value;
  }
  return value.substring(0, visibleChars) + "*".repeat(value.length - visibleChars);
}

// 전화번호 마스킹
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length === 10) {
    return cleaned.substring(0, 3) + "-***-" + cleaned.substring(7);
  } else if (cleaned.length === 11) {
    return cleaned.substring(0, 3) + "-***-" + cleaned.substring(7);
  }
  return maskSensitiveInfo(cleaned, 3);
}
