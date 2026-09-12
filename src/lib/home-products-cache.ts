import { revalidateTag } from "next/cache";

export const HOME_PRODUCTS_CACHE_TAG = "home-products";

export function revalidateHomeProductsCache() {
  revalidateTag(HOME_PRODUCTS_CACHE_TAG);
}
