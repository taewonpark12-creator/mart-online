import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const PRICE_CHANGED_MESSAGE = "상품 가격이 변경되었습니다. 장바구니를 다시 확인해주세요.";
export const PRICE_SOURCE_UNAVAILABLE_MESSAGE = "PRICE_SOURCE_UNAVAILABLE";

export type PriceItem = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice: number | null;
  discountRate?: number | null;
};

export class PriceSourceUnavailableError extends Error {
  readonly code = "PRICE_SOURCE_UNAVAILABLE";
  readonly status = 503;

  constructor(message = PRICE_SOURCE_UNAVAILABLE_MESSAGE) {
    super(message);
  }
}

function toSafePrice(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function getDiscountRate(priceInfo: PriceItem, normalPrice: number, eventPrice: number | null) {
  if (priceInfo.discountRate !== null && priceInfo.discountRate !== undefined) {
    return Number(priceInfo.discountRate);
  }

  if (eventPrice && eventPrice > 0 && eventPrice < normalPrice) {
    return Math.round((1 - eventPrice / normalPrice) * 100);
  }

  return null;
}

export async function loadPriceSource() {
  try {
    const filePath = path.join(process.cwd(), "public", "prices.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("prices.json must contain an array");
    }

    const map = new Map<string, PriceItem>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const priceItem = item as Partial<PriceItem>;
      const barcode = String(priceItem.barcode ?? "").trim();
      const normalPrice = Number(priceItem.normalPrice);
      if (!barcode || !Number.isFinite(normalPrice)) continue;

      map.set(barcode, {
        barcode,
        name: typeof priceItem.name === "string" ? priceItem.name : undefined,
        normalPrice,
        eventPrice:
          priceItem.eventPrice !== null && priceItem.eventPrice !== undefined
            ? Number(priceItem.eventPrice)
            : null,
        discountRate:
          priceItem.discountRate !== null && priceItem.discountRate !== undefined
            ? Number(priceItem.discountRate)
            : null,
      });
    }

    if (map.size === 0) {
      throw new Error("prices.json has no usable price rows");
    }

    return {
      priceMap: map,
      priceSourceVersion: createHash("sha256").update(raw).digest("hex"),
    };
  } catch (error) {
    console.error("[order-pricing] price source unavailable", error);
    throw new PriceSourceUnavailableError();
  }
}

export function getSyncedProductInfo(
  product: {
    id: string;
    name: string;
    barcode: string | null;
    price: bigint | number;
  },
  priceMap: Map<string, PriceItem>,
) {
  const barcode = product.barcode?.trim();
  const priceInfo = barcode ? priceMap.get(barcode) : undefined;

  if (!priceInfo) {
    const dbPrice = toSafePrice(product.price);
    return {
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      price: dbPrice,
      normalPrice: dbPrice,
      eventPrice: null,
      discountRate: null,
      priceSource: "DB" as const,
    };
  }

  const dbPrice = toSafePrice(product.price);
  const normalPrice = toSafePrice(priceInfo.normalPrice, dbPrice);
  const eventPrice =
    priceInfo.eventPrice !== null && priceInfo.eventPrice !== undefined
      ? toSafePrice(priceInfo.eventPrice, 0)
      : null;
  const discountRate = getDiscountRate(priceInfo, normalPrice, eventPrice);
  const hasEvent = eventPrice !== null && eventPrice > 0 && discountRate !== null && discountRate > 0;

  return {
    productId: product.id,
    name: priceInfo.name || product.name,
    barcode: product.barcode,
    price: hasEvent ? eventPrice : normalPrice,
    normalPrice,
    eventPrice,
    discountRate,
    priceSource: "PRICES_JSON" as const,
  };
}
