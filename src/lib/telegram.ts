const TELEGRAM_MESSAGE = [
  "🔔 신규주문이 접수되었습니다.",
  "한사랑마트 관리자에서 확인해주세요.",
].join("\n");

export async function sendNewOrderTelegramAlert() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.info("[telegram] config", {
    hasBotToken: Boolean(token),
    hasChatId: Boolean(chatId),
    chatIdLength: chatId?.length ?? 0,
  });

  if (!token || !chatId) {
    console.info("[telegram] skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response: Response;
  let responseBody = "";

  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: TELEGRAM_MESSAGE,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    responseBody = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  console.info("[telegram] sendMessage response", {
    status: response.status,
    ok: response.ok,
    body: responseBody.slice(0, 1000),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${responseBody.slice(0, 200)}`);
  }
}
