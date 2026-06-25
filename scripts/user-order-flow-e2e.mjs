#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "940326@@";
const MIN_ORDER_AMOUNT = 40_000;

function log(title, payload) {
  console.log(`\n=== ${title} ===`);
  if (payload !== undefined) {
    console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
  }
}

function createClientOrderId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(endpoint, options = {}) {
  const startedAt = Date.now();
  const url = `${BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const raw = await res.text();
    let body = null;

    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = { raw };
      }
    }

    const result = {
      ok: res.ok,
      status: res.status,
      endpoint,
      durationMs: Date.now() - startedAt,
      body,
      headers: res.headers,
    };

    log(`API ${options.method || "GET"} ${endpoint}`, {
      status: result.status,
      durationMs: result.durationMs,
      body: result.body,
    });

    return result;
  } catch (error) {
    const result = {
      ok: false,
      status: null,
      endpoint,
      durationMs: Date.now() - startedAt,
      body: { error: error instanceof Error ? error.message : String(error) },
      headers: null,
    };

    log(`API NETWORK ERROR ${endpoint}`, result);
    return result;
  }
}

async function loadPriceMap() {
  const raw = await readFile(path.join(process.cwd(), "public", "prices.json"), "utf8");
  const rows = JSON.parse(raw);
  const map = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const barcode = String(row?.barcode || "").trim();
    const normalPrice = Number(row?.normalPrice);
    if (!barcode || !Number.isFinite(normalPrice)) continue;

    const eventPrice = row.eventPrice == null ? null : Number(row.eventPrice);
    const discountRate = row.discountRate == null ? null : Number(row.discountRate);
    const hasEvent =
      eventPrice !== null &&
      Number.isFinite(eventPrice) &&
      eventPrice > 0 &&
      eventPrice < normalPrice &&
      discountRate !== null &&
      Number.isFinite(discountRate) &&
      discountRate > 0;

    map.set(barcode, {
      barcode,
      name: typeof row.name === "string" ? row.name : undefined,
      normalPrice,
      eventPrice: Number.isFinite(eventPrice) ? eventPrice : null,
      discountRate: Number.isFinite(discountRate) ? discountRate : null,
      price: hasEvent ? eventPrice : normalPrice,
    });
  }

  return map;
}

function syncProduct(product, priceMap) {
  const barcode = typeof product.barcode === "string" ? product.barcode.trim() : "";
  const priceInfo = barcode ? priceMap.get(barcode) : null;
  const dbPrice = Number(product.price);

  return {
    ...product,
    syncedName: priceInfo?.name || product.name,
    syncedPrice: priceInfo?.price ?? (Number.isFinite(dbPrice) ? dbPrice : 0),
    normalPrice: priceInfo?.normalPrice ?? (Number.isFinite(dbPrice) ? dbPrice : 0),
    eventPrice: priceInfo?.eventPrice ?? null,
    discountRate: priceInfo?.discountRate ?? null,
  };
}

function addToCart(cart, product, quantity = 1) {
  const existing = cart.find((item) => item.productId === product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId: product.id,
      barcode: product.barcode ?? null,
      name: product.syncedName,
      price: product.syncedPrice,
      imageUrl: product.imageUrl,
      normalPrice: product.normalPrice,
      eventPrice: product.eventPrice,
      discountRate: product.discountRate,
      isOutOfStock: product.isOutOfStock,
      maxOrderQuantity: product.maxOrderQuantity,
      quantity,
    });
  }

  log("Cart after add", cart);
}

function changeQuantity(cart, productId, quantity) {
  const item = cart.find((entry) => entry.productId === productId);
  if (!item) throw new Error(`Cart item not found: ${productId}`);

  item.quantity = quantity;
  log("Cart after quantity change", cart);
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function toOrderPayload(cart, overrides = {}) {
  return {
    customerName: "Automated Test",
    customerPhone: "01012345678",
    fulfillmentType: "DELIVERY",
    deliveryAddress: "123 Test-ro, Test-gu, Seoul",
    deliveryEntrance: "No shared entrance code",
    pickupTime: "",
    memo: "Browserless user order flow E2E",
    paymentMethod: "ONSITE_CARD",
    outOfStockPolicy: "CONTACT",
    totalAmount: cartTotal(cart),
    items: cart.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      normalPrice: item.normalPrice,
      eventPrice: item.eventPrice,
      discountRate: item.discountRate,
    })),
    ...overrides,
  };
}

function chooseTwoProducts(products) {
  const candidates = products
    .filter((product) => {
      const stock = Number(product.stock);
      return (
        product.id &&
        !product.isOutOfStock &&
        product.syncedPrice > 0 &&
        Number.isFinite(stock) &&
        stock > 0
      );
    })
    .sort((a, b) => b.syncedPrice - a.syncedPrice);

  if (candidates.length < 2) {
    throw new Error("Need at least 2 active, in-stock products from /api/products to run the success flow.");
  }

  return candidates.slice(0, 2);
}

function adjustCartToMinimum(cart) {
  let total = cartTotal(cart);
  let cursor = 0;

  while (total < MIN_ORDER_AMOUNT && cursor < cart.length) {
    const item = cart[cursor];
    const max = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : Infinity;
    const needed = Math.ceil((MIN_ORDER_AMOUNT - total) / item.price);
    const nextQuantity = Math.min(max, item.quantity + needed);

    if (nextQuantity > item.quantity) {
      item.quantity = nextQuantity;
    }

    total = cartTotal(cart);
    cursor += 1;
  }

  log("Cart after minimum-order adjustment", {
    cart,
    totalAmount: total,
  });

  if (total < MIN_ORDER_AMOUNT) {
    throw new Error("Could not reach minimum order amount with selected 2 items.");
  }
}

async function loginAsAdmin() {
  const result = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!result.ok || !result.headers) return "";

  const setCookie = result.headers.get("set-cookie");
  if (!setCookie) return "";

  return setCookie
    .split(",")
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function findOutOfStockProduct(priceMap) {
  const explicitId = process.env.OUT_OF_STOCK_PRODUCT_ID;
  const cookie = await loginAsAdmin();
  if (!cookie) return null;

  const result = await request("/api/products?activeOnly=false&includeOutOfStock=true", {
    headers: { cookie },
  });
  if (!result.ok || !Array.isArray(result.body)) return null;

  const product = explicitId
    ? result.body.find((item) => item.id === explicitId && item.isActive && item.isOutOfStock)
    : result.body.find((item) => item.isActive && item.isOutOfStock);
  const syncedProduct = product ? syncProduct(product, priceMap) : null;

  return syncedProduct && syncedProduct.syncedPrice > 0 ? syncedProduct : null;
}

async function main() {
  let failed = false;
  log("Target", BASE_URL);

  const priceMap = await loadPriceMap();
  log("prices.json loaded", { usablePriceRows: priceMap.size });

  const productsResult = await request("/api/products");
  if (!productsResult.ok || !Array.isArray(productsResult.body)) {
    throw new Error(`/api/products failed. Cannot run user order flow. Status: ${productsResult.status}`);
  }

  const products = productsResult.body.map((product) => syncProduct(product, priceMap));
  const selectedProducts = chooseTwoProducts(products);
  log(
    "Selected 2 items",
    selectedProducts.map((product) => ({
      id: product.id,
      name: product.syncedName,
      price: product.syncedPrice,
      stock: product.stock,
    })),
  );

  const cart = [];
  addToCart(cart, selectedProducts[0], 1);
  addToCart(cart, selectedProducts[1], 1);
  changeQuantity(cart, cart[0].productId, 2);
  adjustCartToMinimum(cart);

  const successPayload = toOrderPayload(cart);
  log("Request order payload", successPayload);
  const successOrder = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify(successPayload),
  });

  if (successOrder.ok && successOrder.body?.orderNumber) {
    log("ORDER SUCCESS", {
      orderNumber: successOrder.body.orderNumber,
      status: successOrder.status,
      priceSourceVersion: successOrder.body.priceSourceVersion,
    });
  } else {
    failed = true;
    log("ORDER FAILURE", successOrder);
  }

  const tamperedCart = cart.map((item, index) => ({
    ...item,
    price: index === 0 ? item.price + 1 : item.price,
  }));
  const tamperedOrder = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify(toOrderPayload(tamperedCart)),
  });
  const priceTamperRejected = !tamperedOrder.ok && tamperedOrder.body?.code === "PRICE_CHANGED";

  log("Price modification failure case", {
    expectedFailure: "PRICE_CHANGED",
    passed: priceTamperRejected,
    response: tamperedOrder.body,
  });
  if (!priceTamperRejected) failed = true;

  const outOfStockProduct = await findOutOfStockProduct(priceMap);
  if (!outOfStockProduct) {
    failed = true;
    log("Out-of-stock failure case", "No out-of-stock product found. Set ADMIN_PASSWORD or OUT_OF_STOCK_PRODUCT_ID.");
  } else {
    const oosCart = [];
    addToCart(oosCart, outOfStockProduct, Math.max(1, Math.ceil(MIN_ORDER_AMOUNT / outOfStockProduct.syncedPrice)));
    const oosOrder = await request("/api/orders", {
      method: "POST",
      body: JSON.stringify(toOrderPayload(oosCart)),
    });
    const oosRejected = !oosOrder.ok && oosOrder.body?.code === "OUT_OF_STOCK";

    log("Out-of-stock item failure case", {
      expectedFailure: "OUT_OF_STOCK",
      passed: oosRejected,
      response: oosOrder.body,
    });
    if (!oosRejected) failed = true;
  }

  log("FINAL RESULT", {
    success: !failed,
    message: failed ? "One or more E2E checks failed." : "Actual user order flow E2E passed.",
  });

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  log("FATAL", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
