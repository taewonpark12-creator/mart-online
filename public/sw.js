self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally no caching: keep product, cart, and order data on the network path.
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    const parsedPayload = event.data ? event.data.json() : {};
    payload = parsedPayload && typeof parsedPayload === "object" ? parsedPayload : {};
  } catch {
    payload = {};
  }

  const data = {
    type: payload.type === "NEW_ORDER" ? "NEW_ORDER_PUSH" : "UNKNOWN_PUSH",
    orderId: typeof payload.orderId === "string" ? payload.orderId : null,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : null,
  };

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    clientsList.forEach((client) => {
      client.postMessage(data);
    });

    if (data.type !== "NEW_ORDER_PUSH") {
      return;
    }

    await self.registration.showNotification("한사랑마트 신규 주문", {
      body: "새 주문이 접수되었습니다. 주문관리에서 확인해주세요.",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "new-order",
      renotify: true,
      data: {
        url: "/admin/orders",
        type: data.type,
        orderId: data.orderId,
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil((async () => {
    const targetUrl = new URL("/admin/orders", self.location.origin).href;
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of clientsList) {
      if (client.url.startsWith(targetUrl) && "focus" in client) {
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
