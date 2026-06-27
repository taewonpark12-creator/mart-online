import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { formatPrice, FULFILLMENT_TYPE_LABEL, type FulfillmentType } from "@/lib/types";

type NewOrderPushPayload = {
  customerName: string;
  totalAmount: number;
  fulfillmentType: FulfillmentType;
};

function hasVapidConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (!hasVapidConfig()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  return true;
}

function maskName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  return `${trimmed[0]}*${trimmed.slice(2)}`;
}

export async function sendNewOrderPush(payload: NewOrderPushPayload) {
  if (!configureWebPush()) {
    console.warn("[admin-push] VAPID env vars are missing; skipping push notification.");
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { isActive: true },
  });

  if (subscriptions.length === 0) return;

  const body = `${maskName(payload.customerName)} / ${formatPrice(payload.totalAmount)} / ${
    FULFILLMENT_TYPE_LABEL[payload.fulfillmentType]
  }`;
  const pushPayload = JSON.stringify({
    title: "신규주문 접수",
    body,
    url: "/admin/orders",
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          pushPayload,
        );
      } catch (error: any) {
        const statusCode = Number(error?.statusCode ?? 0);
        console.error("[admin-push] send failed", {
          endpoint: subscription.endpoint,
          statusCode,
          message: error instanceof Error ? error.message : String(error),
        });

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { endpoint: subscription.endpoint },
            data: { isActive: false },
          });
        }
      }
    }),
  );
}
