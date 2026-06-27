import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getSafeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }

  return "";
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/https:\/\/[^\s"']+/g, "[url]");
  }

  return String(error).replace(/https:\/\/[^\s"']+/g, "[url]");
}

function getEndpointHost(endpoint: string) {
  try {
    return endpoint ? new URL(endpoint).host : null;
  } catch {
    return "invalid-url";
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let endpoint = "";
  let p256dh = "";
  let auth = "";

  try {
    const body = await req.json();
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
    auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";

    console.info("[POST /api/admin/push/subscribe] payload", {
      hasEndpoint: Boolean(endpoint),
      endpointHost: getEndpointHost(endpoint),
      endpointLength: endpoint.length,
      hasP256dh: Boolean(p256dh),
      p256dhLength: p256dh.length,
      hasAuth: Boolean(auth),
      authLength: auth.length,
      userAgent: req.headers.get("user-agent"),
    });

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent"),
        isActive: true,
      },
      create: {
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent"),
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    const code = getSafeErrorCode(error);
    const message = getSafeErrorMessage(error);
    const isMissingTable =
      code === "P2021" ||
      message.includes("PushSubscription") ||
      message.toLowerCase().includes("does not exist");

    console.error("[POST /api/admin/push/subscribe]", {
      code,
      message,
      hasEndpoint: Boolean(endpoint),
      endpointHost: getEndpointHost(endpoint),
      endpointLength: endpoint.length,
      hasP256dh: Boolean(p256dh),
      p256dhLength: p256dh.length,
      hasAuth: Boolean(auth),
      authLength: auth.length,
    });

    return NextResponse.json(
      {
        error: isMissingTable ? "PUSH_SUBSCRIPTION_TABLE_MISSING" : "SUBSCRIBE_FAILED",
        message: isMissingTable
          ? "PushSubscription table is missing. Run prisma migrate deploy on the production database."
          : message,
        code: code || undefined,
      },
      { status: 500 },
    );
  }
}
