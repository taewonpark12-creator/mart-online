import type { CartItem } from "@/lib/types";
import { formatPrice } from "@/lib/types";

type PriceRow = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice: number | null;
  discountRate?: number | null;
};

export type CartPriceChange = {
  productId: string;
  name: string;
  previousPrice: number;
  currentPrice: number;
};

export type CartPriceSyncResult = {
  items: CartItem[];
  changes: CartPriceChange[];
};

function toPrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function toBarcode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLatestPrice(row: PriceRow) {
  const eventPrice = toPrice(row.eventPrice);
  if (eventPrice !== null && eventPrice > 0) return eventPrice;

  return toPrice(row.normalPrice);
}

function getChangedItemPrice(item: CartItem, latestPrice: number) {
  const unitPrice = toPrice(item.unitPrice);
  const price = toPrice(item.price);

  if (unitPrice !== null && unitPrice !== latestPrice) return unitPrice;
  if (price !== null && price !== latestPrice) return price;

  return null;
}

function getDiscountRate(normalPrice: number, eventPrice: number | null, discountRate: unknown) {
  const explicitDiscountRate = Number(discountRate);
  if (Number.isFinite(explicitDiscountRate) && explicitDiscountRate > 0) {
    return explicitDiscountRate;
  }

  if (eventPrice !== null && eventPrice > 0 && eventPrice < normalPrice) {
    return Math.round((1 - eventPrice / normalPrice) * 100);
  }

  return null;
}

async function fetchLatestPriceRows() {
  const response = await fetch(`/prices.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("prices.json load failed");
  }

  const data = (await response.json()) as unknown;
  const rows = new Map<string, PriceRow>();
  if (!Array.isArray(data)) return rows;

  for (const item of data) {
    if (!item || typeof item !== "object") continue;

    const row = item as Partial<PriceRow>;
    const barcode = toBarcode(row.barcode);
    const normalPrice = toPrice(row.normalPrice);
    if (!barcode || normalPrice === null) continue;

    const eventPrice = toPrice(row.eventPrice);
    rows.set(barcode, {
      barcode,
      name: typeof row.name === "string" ? row.name : undefined,
      normalPrice,
      eventPrice,
      discountRate:
        row.discountRate !== null && row.discountRate !== undefined
          ? Number(row.discountRate)
          : null,
    });
  }

  return rows;
}

export async function syncCartPricesWithLatestSource(items: CartItem[]): Promise<CartPriceSyncResult> {
  if (items.length === 0) return { items, changes: [] };

  const latestPricesByBarcode = await fetchLatestPriceRows();
  const changes: CartPriceChange[] = [];
  let changed = false;

  const nextItems = items.map((item) => {
    const barcode = toBarcode(item.barcode);
    if (!barcode) return item;

    const latest = latestPricesByBarcode.get(barcode);
    if (!latest) return item;

    const latestPrice = getLatestPrice(latest);
    if (latestPrice === null) {
      return item;
    }

    const changedPrice = getChangedItemPrice(item, latestPrice);
    if (changedPrice === null) {
      return item;
    }

    const eventPrice = toPrice(latest.eventPrice);
    const hasEventPrice = eventPrice !== null && eventPrice > 0;
    const latestDiscountRate = getDiscountRate(latest.normalPrice, hasEventPrice ? eventPrice : null, latest.discountRate);

    changes.push({
      productId: item.productId,
      name: item.name || latest.name || "상품",
      previousPrice: changedPrice,
      currentPrice: latestPrice,
    });
    changed = true;

    return {
      ...item,
      price: latestPrice,
      unitPrice: latestPrice,
      normalPrice: latest.normalPrice,
      eventPrice: hasEventPrice ? eventPrice : null,
      discountRate: latestDiscountRate,
    };
  });

  return {
    items: changed ? nextItems : items,
    changes,
  };
}

export function formatCartPriceChangeNotice(changes: CartPriceChange[]) {
  if (changes.length === 0) return "";

  const detail = changes
    .map((change) => `${change.name}: ${formatPrice(change.previousPrice)} → ${formatPrice(change.currentPrice)}`)
    .join("\n");

  return `장바구니 상품 가격이 변경되었습니다. 최신 가격으로 반영했어요.\n${detail}`;
}
