/**
 * Korea (KST, UTC+9) date utilities
 * All functions return "YYYY-MM-DD" format in Korean timezone
 */

export function getKoreaTodayString(): string {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000; // UTC+9 in milliseconds
  const koreaTime = new Date(now.getTime() + koreaOffset);
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(koreaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getKoreaYesterdayString(): string {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000; // UTC+9 in milliseconds
  const koreaTime = new Date(now.getTime() + koreaOffset);
  koreaTime.setUTCDate(koreaTime.getUTCDate() - 1);
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(koreaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getKoreaMonthStartString(): string {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000; // UTC+9 in milliseconds
  const koreaTime = new Date(now.getTime() + koreaOffset);
  const year = koreaTime.getUTCFullYear();
  const month = koreaTime.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const yearStr = firstDay.getUTCFullYear();
  const monthStr = String(firstDay.getUTCMonth() + 1).padStart(2, "0");
  const dayStr = String(firstDay.getUTCDate()).padStart(2, "0");
  return `${yearStr}-${monthStr}-${dayStr}`;
}

export function getKoreaDaysAgoString(days: number): string {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000; // UTC+9 in milliseconds
  const koreaTime = new Date(now.getTime() + koreaOffset);
  koreaTime.setUTCDate(koreaTime.getUTCDate() - days);
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(koreaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getKoreaDateRangeUtc(startDate: string | null, endDate: string | null): { startUtc: Date | null; endUtc: Date | null } {
  if (!startDate && !endDate) {
    return { startUtc: null, endUtc: null };
  }

  let startUtc: Date | null = null;
  let endUtc: Date | null = null;

  if (startDate) {
    const [y, m, d] = startDate.split("-").map(Number);
    // KST 00:00:00 = UTC -9:00:00 (previous day 15:00:00 UTC)
    startUtc = new Date(Date.UTC(y, m - 1, d, -9, 0, 0, 0));
  }

  if (endDate) {
    const [y, m, d] = endDate.split("-").map(Number);
    // KST 23:59:59.999 = UTC 14:59:59.999 (same day)
    endUtc = new Date(Date.UTC(y, m - 1, d, 14, 59, 59, 999));
  }

  return { startUtc, endUtc };
}
