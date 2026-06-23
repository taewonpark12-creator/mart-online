import { NextResponse } from "next/server";
import {
  ORDER_CUTOFF_HOUR,
  ORDER_CUTOFF_MINUTE,
  isAfterCutoffTime,
} from "@/lib/delivery-schedule";

export async function GET() {
  const now = new Date();

  return NextResponse.json({
    afterCutoff: isAfterCutoffTime(now),
    cutoffHour: ORDER_CUTOFF_HOUR,
    cutoffMinute: ORDER_CUTOFF_MINUTE,
    serverTime: now.toISOString(),
  });
}
