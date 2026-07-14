#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const DEBUG = String(process.env.DEBUG || "").toLowerCase() === "true";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const MIN_ORDER_AMOUNT = 40_000;
const RETRY_DELAYS_MS = [300, 600, 1200];
const CRITICAL_RETRY_ENDPOINTS = new Set([
  "/api/products",
  "/api/admin/orders/pending-count",
]);

const state = {
  results: [],
  failedStep: null,
  statusCode: null,
  endpoint: null,
  category: null,
  suggestedCause: null,
  diagnostics: [],
};

function debug(message, payload) {
  if (!DEBUG) return;
  console.log(`[DEBUG] ${message}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEndpoint(endpoint) {
  return endpoint.split("?")[0];
}

function categorizeFailure(statusCode, networkError = false) {
  if (networkError) return "NETWORK_ERROR";
  if (statusCode === 401 || statusCode === 403) return "AUTH_ERROR";
  if (statusCode === 400) return "VALIDATION_ERROR";
  if (statusCode >= 500) return "SERVER_ERROR";
  if (statusCode === 404) return "NOT_FOUND";
  return "API_ERROR";
}

function suggestedCauseFor({ endpoint, statusCode, category, body }) {
  const bodyText = typeof body === "string" ? body : JSON.stringify(body || {});
  if (category === "NETWORK_ERROR") return "server_not_running_or_base_url_unreachable";
  if (category === "AUTH_ERROR") return "missing_or_invalid_admin_session";
  if (endpoint === "/api/products" && statusCode >= 500) return "database_connection_or_missing_seed_data";
  if (endpoint === "/api/admin/orders/pending-count" && statusCode >= 500) return "admin_order_count_query_or_database_failure";
  if (String(bodyText).includes("가격") || String(bodyText).toLowerCase().includes("price")) return "price_validation_or_prices_json_mismatch";
  if (String(bodyText).includes("품절")) return "out_of_stock_validation";
  if (String(bodyText).includes("수량")) return "quantity_validation";
  if (statusCode === 404) return "endpoint_not_implemented_or_wrong_base_url";
  return "inspect_response_body_and_server_logs";
}

function recordResult(result) {
  state.results.push(result);

  if (!result.ok && !state.failedStep) {
    state.failedStep = result.step;
    state.statusCode = result.statusCode ?? null;
    state.endpoint = result.endpoint ?? null;
    state.category = result.category ?? null;
    state.suggestedCause = result.suggestedCause ?? null;
  }

  const label = result.ok ? "SUCCESS" : "FAILURE";
  console.log(`${label} ${result.step} - ${result.reason}`);
}

function recordFailure({ step, reason, endpoint, statusCode, category, body, suggestedCause }) {
  const resolvedCategory = category || categorizeFailure(statusCode || 0);
  const resolvedSuggestedCause =
    suggestedCause ||
    suggestedCauseFor({
      endpoint,
      statusCode,
      category: resolvedCategory,
      body,
    });

  const diagnostic = {
    step,
    endpoint,
    statusCode: statusCode ?? null,
    category: resolvedCategory,
    responseBody: body ?? null,
    suggestedCause: resolvedSuggestedCause,
  };
  state.diagnostics.push(diagnostic);

  recordResult({
    ok: false,
    step,
    reason,
    endpoint,
    statusCode,
    category: resolvedCategory,
    suggestedCause: resolvedSuggestedCause,
  });
}

function recordSuccess(step, reason, extra = {}) {
  recordResult({ ok: true, step, reason, ...extra });
}

async function requestJson(endpoint, options = {}) {
  const phase = options.phase || endpoint;
  const method = options.method || "GET";
  const retryableEndpoint = CRITICAL_RETRY_ENDPOINTS.has(normalizeEndpoint(endpoint));
  const maxAttempts = retryableEndpoint ? RETRY_DELAYS_MS.length + 1 : 1;
  const url = `${BASE_URL}${endpoint}`;
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        ...options,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      const durationMs = Date.now() - startedAt;
      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      lastResult = {
        ok: res.ok,
        statusCode: res.status,
        endpoint,
        url,
        phase,
        method,
        durationMs,
        attempt,
        headers: res.headers,
        data,
        rawBody: text,
        category: res.ok ? null : categorizeFailure(res.status),
      };

      debug(`API response ${phase}`, lastResult);

      if (res.ok) return lastResult;

      const shouldRetry = retryableEndpoint && res.status >= 500 && attempt < maxAttempts;
      if (!shouldRetry) return lastResult;

      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      lastResult = {
        ok: false,
        statusCode: null,
        endpoint,
        url,
        phase,
        method,
        durationMs,
        attempt,
        headers: null,
        data: null,
        rawBody: "",
        category: "NETWORK_ERROR",
        networkError: error instanceof Error ? error.message : String(error),
      };

      debug(`API network failure ${phase}`, lastResult);

      const shouldRetry = retryableEndpoint && attempt < maxAttempts;
      if (!shouldRetry) return lastResult;

      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  return lastResult;
}

async function loadPriceMap() {
  const raw = await readFile(path.join(process.cwd(), "public", "prices.json"), "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) {
    throw new Error("public/prices.json must be an array.");
  }

  const map = new Map();
  for (const row of rows) {
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
      eventPrice: eventPrice !== null && Number.isFinite(eventPrice) ? eventPrice : null,
      discountRate: discountRate !== null && Number.isFinite(discountRate) ? discountRate : null,
      payablePrice: hasEvent ? eventPrice : normalPrice,
    });
  }
  return map;
}

function syncProduct(product, priceMap) {
  const barcode = typeof product.barcode === "string" ? product.barcode.trim() : "";
  const priceInfo = barcode ? priceMap.get(barcode) : null;
  const dbPrice = Number(product.price);

  if (!priceInfo) {
    debug("Price comparison fallback to DB price", {
      productId: product.id,
      barcode,
      dbPrice,
    });
    return {
      ...product,
      syncedName: product.name,
      syncedPrice: Number.isFinite(dbPrice) ? dbPrice : 0,
    };
  }

  debug("Price comparison from prices.json", {
    productId: product.id,
    barcode,
    dbPrice,
    normalPrice: priceInfo.normalPrice,
    eventPrice: priceInfo.eventPrice,
    discountRate: priceInfo.discountRate,
    payablePrice: priceInfo.payablePrice,
  });

  return {
    ...product,
    syncedName: priceInfo.name || product.name,
    syncedPrice: priceInfo.payablePrice,
    normalPrice: priceInfo.normalPrice,
    eventPrice: priceInfo.eventPrice,
    discountRate: priceInfo.discountRate,
  };
}

function addToCart(cart, product, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Cart quantity must be a positive integer.");
  }

  const existing = cart.find((item) => item.productId === product.id);
  if (existing) {
    existing.quantity += quantity;
    debug("Cart add existing item", { cart });
    return cart;
  }

  cart.push({
    productId: product.id,
    barcode: product.barcode ?? null,
    name: product.syncedName,
    price: product.syncedPrice,
    quantity,
  });
  debug("Cart add new item", { cart });
  return cart;
}

function updateCartQuantity(cart, productId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Cart quantity update must be a positive integer.");
  }

  const item = cart.find((entry) => entry.productId === productId);
  if (!item) throw new Error("Cart item was not found for quantity update.");

  item.quantity = quantity;
  debug("Cart quantity update", { cart });
  return cart;
}

function removeFromCart(cart, productId) {
  const next = cart.filter((item) => item.productId !== productId);
  debug("Cart remove", { cart: next });
  return next;
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderPayload(items, overrides = {}) {
  return {
    customerName: "자동테스트",
    customerPhone: "01012345678",
    fulfillmentType: "DELIVERY",
    deliveryAddress: "서울특별시 테스트구 테스트로 123",
    deliveryEntrance: "공동현관 없음",
    pickupTime: "",
    memo: "자동 주문 워크플로우 검증",
    paymentMethod: "ONSITE_CARD",
    outOfStockPolicy: "CONTACT",
    items: items.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    totalAmount: cartTotal(items),
    ...overrides,
  };
}

function chooseOrderItems(products) {
  const candidates = products
    .filter((product) => product.id && !product.isOutOfStock && product.syncedPrice > 0)
    .sort((a, b) => b.syncedPrice - a.syncedPrice);

  if (candidates.length === 0) {
    throw new Error("No orderable products were returned from /api/products.");
  }

  const selected = [];
  let total = 0;
  for (const product of candidates) {
    selected.push(product);
    total += product.syncedPrice;
    if (total >= MIN_ORDER_AMOUNT) break;
  }

  if (total >= MIN_ORDER_AMOUNT) {
    return selected.map((product) => ({ product, quantity: 1 }));
  }

  const product = candidates.find((item) => {
    const needed = Math.ceil(MIN_ORDER_AMOUNT / item.syncedPrice);
    return !item.maxOrderQuantity || item.maxOrderQuantity >= needed;
  });

  if (!product) {
    throw new Error("Could not satisfy minimum order amount without exceeding maxOrderQuantity.");
  }

  return [{ product, quantity: Math.ceil(MIN_ORDER_AMOUNT / product.syncedPrice) }];
}

async function loginAsAdmin() {
  if (!ADMIN_PASSWORD) return "";

  const result = await requestJson("/api/admin/login", {
    phase: "admin-login",
    method: "POST",
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!result.ok) return "";

  const setCookie = result.headers?.get?.("set-cookie");
  return setCookie
    ? setCookie
        .split(",")
        .map((cookie) => cookie.split(";")[0])
        .join("; ")
    : "";
}

async function findOutOfStockProduct(priceMap) {
  const explicitId = process.env.OUT_OF_STOCK_PRODUCT_ID;
  const cookie = await loginAsAdmin();
  if (!cookie) return null;

  const result = await requestJson("/api/products?activeOnly=false&includeOutOfStock=true", {
    phase: "load-admin-products-for-out-of-stock",
    headers: { cookie },
  });
  if (!result.ok || !Array.isArray(result.data)) return null;

  const product = explicitId
    ? result.data.find((item) => item.id === explicitId && item.isActive && item.isOutOfStock)
    : result.data.find((item) => item.isActive && item.isOutOfStock);

  return product ? syncProduct(product, priceMap) : null;
}

async function preflightHealthCheck() {
  const health = await requestJson("/api/health", { phase: "health-check" });
  if (health.ok) {
    recordSuccess("preflight-health", "GET /api/health returned OK.", {
      endpoint: "/api/health",
      statusCode: health.statusCode,
    });
    return true;
  }

  if (health.statusCode !== 404) {
    recordFailure({
      step: "preflight-health",
      reason: `SERVER_NOT_READY: /api/health failed with ${health.statusCode ?? health.category}`,
      endpoint: "/api/health",
      statusCode: health.statusCode,
      category: health.category,
      body: health.data || health.networkError,
      suggestedCause: "server_not_ready_or_health_check_failure",
    });
    return false;
  }

  const fallback = await requestJson("/api/products", { phase: "preflight-products-fallback" });
  if (fallback.ok) {
    recordSuccess("preflight-health", "GET /api/health missing; /api/products fallback returned OK.", {
      endpoint: "/api/products",
      statusCode: fallback.statusCode,
    });
    return true;
  }

  recordFailure({
    step: "preflight-health",
    reason: `SERVER_NOT_READY: /api/products fallback failed with ${fallback.statusCode ?? fallback.category}`,
    endpoint: "/api/products",
    statusCode: fallback.statusCode,
    category: fallback.category,
    body: fallback.data || fallback.networkError,
    suggestedCause: suggestedCauseFor({
      endpoint: "/api/products",
      statusCode: fallback.statusCode,
      category: fallback.category,
      body: fallback.data || fallback.networkError,
    }),
  });
  return false;
}

async function runStep(step, fn) {
  try {
    await fn();
  } catch (error) {
    recordFailure({
      step,
      reason: error instanceof Error ? error.message : String(error),
      category: "TEST_ASSERTION_ERROR",
      suggestedCause: "test_precondition_or_assertion_failed",
    });
  }
}

function printSummary() {
  const failed = state.results.filter((result) => !result.ok);
  const summary = {
    result: failed.length > 0 ? "FAILED" : "PASSED",
    failedStep: state.failedStep,
    statusCode: state.statusCode,
    endpoint: state.endpoint,
    category: state.category,
    suggestedCause: state.suggestedCause,
    totalSteps: state.results.length,
    passedSteps: state.results.filter((result) => result.ok).length,
    failedSteps: failed.length,
    diagnostics: state.diagnostics,
  };

  console.log("\n========== ORDER WORKFLOW TEST SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));
  console.log("=================================================");

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  console.log(`Order workflow API test target: ${BASE_URL}`);
  console.log(`Debug mode: ${DEBUG ? "enabled" : "disabled"}`);
  console.log("This script uses real API calls. A successful normal flow creates a real test order.");

  const serverReady = await preflightHealthCheck();
  if (!serverReady) {
    printSummary();
    return;
  }

  let priceMap = new Map();
  await runStep("load-prices-json", async () => {
    priceMap = await loadPriceMap();
    if (priceMap.size === 0) throw new Error("No usable entries were loaded from public/prices.json.");
    recordSuccess("load-prices-json", `${priceMap.size} usable prices loaded.`);
  });

  let products = [];
  await runStep("load-products", async () => {
    const response = await requestJson("/api/products", { phase: "load-products" });
    if (!response.ok) {
      recordFailure({
        step: "load-products",
        reason: `/api/products failed with HTTP ${response.statusCode ?? response.category}`,
        endpoint: "/api/products",
        statusCode: response.statusCode,
        category: response.category,
        body: response.data || response.networkError,
      });
      return;
    }
    if (!Array.isArray(response.data)) throw new Error("/api/products did not return an array.");
    if (response.data.length === 0) throw new Error("/api/products returned no products.");

    products = response.data.map((product) => syncProduct(product, priceMap));
    const syncedMatches = products.filter((product) => product.barcode && priceMap.has(String(product.barcode).trim())).length;
    if (syncedMatches === 0) throw new Error("No fetched products matched public/prices.json by barcode.");
    recordSuccess("load-products", `${products.length} products loaded, ${syncedMatches} matched prices.json.`, {
      endpoint: "/api/products",
      statusCode: response.statusCode,
    });
  });

  let cart = [];
  await runStep("cart-operations", async () => {
    if (products.length === 0) throw new Error("Skipped because products are unavailable.");

    const selected = chooseOrderItems(products);
    let tempCart = [];
    for (const entry of selected) addToCart(tempCart, entry.product, entry.quantity);
    if (tempCart.length === 0) throw new Error("Cart add failed.");

    const first = tempCart[0];
    updateCartQuantity(tempCart, first.productId, first.quantity + 1);
    tempCart = removeFromCart(tempCart, first.productId);
    if (tempCart.some((item) => item.productId === first.productId)) throw new Error("Cart remove failed.");

    cart = [];
    for (const entry of selected) addToCart(cart, entry.product, entry.quantity);
    if (cartTotal(cart) < MIN_ORDER_AMOUNT) {
      updateCartQuantity(
        cart,
        cart[0].productId,
        cart[0].quantity + Math.ceil((MIN_ORDER_AMOUNT - cartTotal(cart)) / cart[0].price),
      );
    }
    if (cartTotal(cart) < MIN_ORDER_AMOUNT) throw new Error("Cart total did not reach minimum order amount.");

    recordSuccess("cart-operations", `Cart add/update/remove passed. Final total: ${cartTotal(cart).toLocaleString("ko-KR")}원.`);
  });

  await runStep("scenario-1-normal-order", async () => {
    if (cart.length === 0) throw new Error("Skipped because cart is unavailable.");

    const response = await requestJson("/api/orders", {
      phase: "checkout-normal-order",
      method: "POST",
      body: JSON.stringify(orderPayload(cart)),
    });
    if (response.statusCode !== 201) {
      recordFailure({
        step: "scenario-1-normal-order",
        reason: `Expected HTTP 201, got ${response.statusCode ?? response.category}`,
        endpoint: "/api/orders",
        statusCode: response.statusCode,
        category: response.category,
        body: response.data || response.networkError,
      });
      return;
    }
    if (!response.data?.orderNumber) throw new Error("Order response did not include orderNumber.");
    recordSuccess("scenario-1-normal-order", `Order created: ${response.data.orderNumber}`);
  });

  await runStep("scenario-2-price-tampering", async () => {
    if (cart.length === 0) throw new Error("Skipped because cart is unavailable.");

    const tamperedItems = cart.map((item, index) => ({
      ...item,
      price: index === 0 ? item.price + 1 : item.price,
    }));
    const response = await requestJson("/api/orders", {
      phase: "checkout-price-tampering",
      method: "POST",
      body: JSON.stringify(orderPayload(tamperedItems)),
    });
    if (response.statusCode !== 409) {
      recordFailure({
        step: "scenario-2-price-tampering",
        reason: `Expected HTTP 409, got ${response.statusCode ?? response.category}`,
        endpoint: "/api/orders",
        statusCode: response.statusCode,
        category: response.category,
        body: response.data || response.networkError,
      });
      return;
    }
    recordSuccess("scenario-2-price-tampering", response.data?.error || "Price tampering was rejected.");
  });

  await runStep("scenario-3-out-of-stock", async () => {
    if (priceMap.size === 0) throw new Error("Skipped because price data is unavailable.");

    const product = await findOutOfStockProduct(priceMap);
    if (!product) {
      throw new Error("No out-of-stock product found. Set ADMIN_PASSWORD or OUT_OF_STOCK_PRODUCT_ID to enable this scenario.");
    }

    const oosCart = [];
    addToCart(oosCart, product, Math.max(1, Math.ceil(MIN_ORDER_AMOUNT / product.syncedPrice)));
    const response = await requestJson("/api/orders", {
      phase: "checkout-out-of-stock",
      method: "POST",
      body: JSON.stringify(orderPayload(oosCart)),
    });
    if (response.statusCode !== 400) {
      recordFailure({
        step: "scenario-3-out-of-stock",
        reason: `Expected HTTP 400, got ${response.statusCode ?? response.category}`,
        endpoint: "/api/orders",
        statusCode: response.statusCode,
        category: response.category,
        body: response.data || response.networkError,
      });
      return;
    }
    recordSuccess("scenario-3-out-of-stock", response.data?.error || "Out-of-stock order was rejected.");
  });

  await runStep("scenario-4-invalid-quantity", async () => {
    if (cart.length === 0) throw new Error("Skipped because cart is unavailable.");

    const invalidCart = cart.map((item, index) => ({
      ...item,
      quantity: index === 0 ? 0 : item.quantity,
    }));
    const response = await requestJson("/api/orders", {
      phase: "checkout-invalid-quantity",
      method: "POST",
      body: JSON.stringify(orderPayload(invalidCart)),
    });
    if (response.statusCode !== 400) {
      recordFailure({
        step: "scenario-4-invalid-quantity",
        reason: `Expected HTTP 400, got ${response.statusCode ?? response.category}`,
        endpoint: "/api/orders",
        statusCode: response.statusCode,
        category: response.category,
        body: response.data || response.networkError,
      });
      return;
    }
    recordSuccess("scenario-4-invalid-quantity", response.data?.error || "Invalid quantity was rejected.");
  });

  const pendingCount = await requestJson("/api/admin/orders/pending-count", {
    phase: "diagnostic-pending-count",
  });
  if (!pendingCount.ok) {
    recordFailure({
      step: "diagnostic-pending-count",
      reason: `/api/admin/orders/pending-count failed with HTTP ${pendingCount.statusCode ?? pendingCount.category}`,
      endpoint: "/api/admin/orders/pending-count",
      statusCode: pendingCount.statusCode,
      category: pendingCount.category,
      body: pendingCount.data || pendingCount.networkError,
    });
  } else {
    recordSuccess("diagnostic-pending-count", "Pending count endpoint returned OK.");
  }

  printSummary();
}

main().catch((error) => {
  recordFailure({
    step: "fatal",
    reason: error instanceof Error ? error.message : String(error),
    category: "UNHANDLED_TEST_ERROR",
    suggestedCause: "inspect_stack_trace_and_test_script",
  });
  printSummary();
});
