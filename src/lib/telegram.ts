import { logSafeOrderError, logSafeOrderEvent } from "@/lib/order-observability";

const TELEGRAM_MESSAGE = [
  "🔔 신규주문이 접수되었습니다.",
  "한사랑마트 관리자에서 확인해주세요.",
].join("\n");

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  logSafeOrderEvent("telegram.config.checked", {
    hasBotToken: Boolean(token),
    hasChatId: Boolean(chatId),
  });

  return { token, chatId };
}

async function sendTelegramMessage(text: string, messageType: "new_order" | "pending_reminder") {
  const { token, chatId } = getTelegramConfig();
  const startedAt = Date.now();

  if (!token || !chatId) {
    logSafeOrderEvent("telegram.send.skipped", {
      messageType,
      reason: "MISSING_CONFIG",
      elapsedMs: Date.now() - startedAt,
    }, "warn");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response: Response;

  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    await response.text();
  } finally {
    clearTimeout(timeout);
  }

  logSafeOrderEvent("telegram.send.completed", {
    messageType,
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status}`);
  }
}

export async function sendNewOrderTelegramAlert() {
  try {
    await sendTelegramMessage(TELEGRAM_MESSAGE, "new_order");
    logSafeOrderEvent("telegram.new_order.succeeded");
  } catch (error) {
    logSafeOrderError("telegram.new_order.failed", {}, error);
    throw error;
  }
}

export async function sendPendingOrderReminderTelegramAlert(pendingCount: number) {
  const message = [
    "🚨 미확인 신규주문 알림",
    `현재 미처리 신규 주문 ${pendingCount}건`,
    "관리자 주문관리 페이지에서 확인해주세요.",
  ].join("\n");

  try {
    await sendTelegramMessage(message, "pending_reminder");
    logSafeOrderEvent("telegram.pending_reminder.succeeded", { pendingCount });
  } catch (error) {
    logSafeOrderError("telegram.pending_reminder.failed", { pendingCount }, error);
    throw error;
  }
}
