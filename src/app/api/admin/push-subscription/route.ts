import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

type PushSubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function normalizeSubscriptionBody(body: PushSubscriptionBody) {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  if (!endpoint.startsWith("https://") || endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return jsonNoStore({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonNoStore({ error: "올바른 Push 구독 정보가 필요합니다." }, { status: 400 });
  }

  const subscription = normalizeSubscriptionBody(body as PushSubscriptionBody);
  if (!subscription) {
    return jsonNoStore({ error: "Push 구독 정보가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      create: subscription,
    });

    return jsonNoStore({ ok: true });
  } catch (error) {
    console.error("[POST /api/admin/push-subscription]", error);
    return jsonNoStore({ error: "Push 구독 저장에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return jsonNoStore({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint =
    body && typeof body === "object" && typeof (body as { endpoint?: unknown }).endpoint === "string"
      ? (body as { endpoint: string }).endpoint.trim()
      : "";

  if (!endpoint || !endpoint.startsWith("https://") || endpoint.length > 2048) {
    return jsonNoStore({ error: "Push 구독 endpoint가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return jsonNoStore({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/push-subscription]", error);
    return jsonNoStore({ error: "Push 구독 삭제에 실패했습니다." }, { status: 500 });
  }
}
