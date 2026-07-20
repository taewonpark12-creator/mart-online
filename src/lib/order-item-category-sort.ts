import { PRODUCT_CATEGORIES } from "@/lib/types";

const categoryOrder = new Map<string, number>(PRODUCT_CATEGORIES.map((category, index) => [category, index]));
const UNKNOWN_CATEGORY_ORDER = PRODUCT_CATEGORIES.length;

type OrderItemWithCategory = {
  product?: {
    category?: string | null;
  } | null;
};

function getCategoryOrder(item: OrderItemWithCategory) {
  const category = item.product?.category ?? "";
  return categoryOrder.get(category) ?? UNKNOWN_CATEGORY_ORDER;
}

export function sortOrderItemsByProductCategory<T extends OrderItemWithCategory>(items: readonly T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const categoryDiff = getCategoryOrder(a.item) - getCategoryOrder(b.item);
      if (categoryDiff !== 0) return categoryDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
