import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/prisma";
import { logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

type NewOrderPushPayload = {
  type: "NEW_ORDER";
  orderId: string;
  createdAt: string;
};

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey && subject),
  };
}

function toWebPushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isExpiredSubscriptionStatus(statusCode?: number) {
  return statusCode === 404 || statusCode === 410;
}

export async function sendNewOrderWebPush(payload: NewOrderPushPayload) {
  const vapid = getVapidConfig();

  if (!vapid.configured) {
    logSafeOrderEvent("web_push.new_order.skipped", {
      reason: "MISSING_VAPID_CONFIG",
      hasPublicKey: Boolean(vapid.publicKey),
      hasPrivateKey: Boolean(vapid.privateKey),
      hasSubject: Boolean(vapid.subject),
    }, "warn");
    return;
  }

  webpush.setVapidDetails(vapid.subject!, vapid.publicKey!, vapid.privateKey!);

  const subscriptions = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    logSafeOrderEvent("web_push.new_order.skipped", {
      reason: "NO_SUBSCRIPTIONS",
      orderId: payload.orderId,
    });
    return;
  }

  const message = JSON.stringify(payload);
  let successCount = 0;
  let failureCount = 0;
  let expiredCount = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), message);
        successCount += 1;
      } catch (error) {
        failureCount += 1;
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : undefined;

        if (isExpiredSubscriptionStatus(statusCode)) {
          expiredCount += 1;
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
          logSafeOrderEvent("web_push.subscription.deleted", {
            reason: "EXPIRED",
            statusCode,
          });
          return;
        }

        logSafeOrderError("web_push.new_order.subscription_failed", {
          orderId: payload.orderId,
          subscriptionId: subscription.id,
          statusCode: statusCode ?? null,
        }, error);
      }
    }),
  );

  logSafeOrderEvent("web_push.new_order.completed", {
    orderId: payload.orderId,
    subscriptionCount: subscriptions.length,
    successCount,
    failureCount,
    expiredCount,
  });
}
