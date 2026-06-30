const FALLBACK_PRODUCT_NAME = "상품명 없음";
const PLACEHOLDER_PRODUCT_NAMES = new Set(["."]);

export function meaningfulProductName(value: unknown) {
  if (typeof value !== "string") return "";

  const name = value.trim();
  if (!name || PLACEHOLDER_PRODUCT_NAMES.has(name)) return "";

  return name;
}

export function firstMeaningfulProductName(...values: unknown[]) {
  for (const value of values) {
    const name = meaningfulProductName(value);
    if (name) return name;
  }

  return "";
}

export function orderItemName(item: {
  productName?: string | null;
  name?: string | null;
  product?: { name?: string | null } | null;
}) {
  return firstMeaningfulProductName(item.productName, item.product?.name, item.name) || FALLBACK_PRODUCT_NAME;
}

export function orderItemBarcode(item: { product?: { barcode?: string | null } | null }) {
  return item.product?.barcode?.trim() || null;
}
