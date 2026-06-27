import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";

    if (!endpoint) {
      return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
    }

    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/admin/push/unsubscribe]", error);
    return NextResponse.json({ error: "UNSUBSCRIBE_FAILED" }, { status: 500 });
  }
}
