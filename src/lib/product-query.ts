import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ProductListOptions = {
  category?: string;
  q?: string;
  activeOnly?: boolean;
  recommendedOnly?: boolean;
  excludeRecommended?: boolean;
  popularOnly?: boolean;
  onlineExclusiveOnly?: boolean;
  outOfStockOnly?: boolean;
  includeOutOfStock?: boolean;
};

type ProductWithPrice = {
  price: bigint | number;
};

export function serializeProduct<T extends ProductWithPrice>(product: T) {
  return {
    ...product,
    price: product.price.toString(),
  };
}

function getProductWhere(options: ProductListOptions): Prisma.ProductWhereInput {
  const {
    category = "",
    q = "",
    activeOnly = true,
    recommendedOnly = false,
    excludeRecommended = false,
    popularOnly = false,
    onlineExclusiveOnly = false,
    outOfStockOnly = false,
    includeOutOfStock = false,
  } = options;

  return {
    ...(activeOnly ? { isActive: true } : {}),
    ...(recommendedOnly ? { isRecommended: true } : {}),
    ...(excludeRecommended ? { isRecommended: false } : {}),
    ...(popularOnly ? { isPopular: true } : {}),
    ...(onlineExclusiveOnly ? { isOnlineExclusive: true } : {}),
    ...(category && category !== "전체" ? { category } : {}),
    ...(outOfStockOnly ? { isOutOfStock: true } : {}),
    ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
  };
}

function getProductOrderBy(options: ProductListOptions): Prisma.ProductOrderByWithRelationInput[] {
  if (options.recommendedOnly) {
    return [{ recommendedOrder: "desc" }, { name: "asc" }];
  }

  return [{ category: "asc" }, { name: "asc" }];
}

export async function findProducts(options: ProductListOptions = {}) {
  const products = await prisma.product.findMany({
    where: getProductWhere(options),
    orderBy: getProductOrderBy(options),
  });

  return products.map(serializeProduct);
}

export function getHomeProductCollections<T extends { isRecommended: boolean; isPopular: boolean; isOnlineExclusive: boolean; recommendedOrder: number; name: string }>(
  products: T[],
) {
  const recommendedProducts = products
    .filter((product) => product.isRecommended)
    .sort((a, b) => {
      const orderDiff = b.recommendedOrder - a.recommendedOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });

  return {
    products,
    recommendedProducts,
    popularProducts: products.filter((product) => product.isPopular),
    onlineExclusiveProducts: products.filter((product) => product.isOnlineExclusive),
  };
}
