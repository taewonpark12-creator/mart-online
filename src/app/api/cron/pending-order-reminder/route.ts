import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPendingOrderReminderTelegramAlert } from "@/lib/telegram";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");

  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pendingCount = await prisma.order.count({
      where: { status: "PENDING" },
    });

    if (pendingCount > 0) {
      await sendPendingOrderReminderTelegramAlert(pendingCount);
    }

    return NextResponse.json({
      ok: true,
      pendingCount,
      notified: pendingCount > 0,
    });
  } catch (error) {
    console.error("[GET /api/cron/pending-order-reminder]", error);
    return NextResponse.json({ error: "Pending order reminder failed." }, { status: 500 });
  }
}
