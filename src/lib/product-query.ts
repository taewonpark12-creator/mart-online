import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;

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
  customerSearchFieldsOnly?: boolean;
  page?: number;
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
  const page = options.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: getProductWhere(options),
      orderBy: getProductOrderBy(options),
      skip,
      take: PAGE_SIZE,
      ...(options.customerSearchFieldsOnly
        ? {
            select: {
              id: true,
              name: true,
              barcode: true,
              price: true,
              category: true,
              imageUrl: true,
              isRecommended: true,
              isOnlineExclusive: true,
              isPopular: true,
              isOutOfStock: true,
              recommendedOrder: true,
              popularOrder: true,
              maxOrderQuantity: true,
            },
          }
        : {}),
    }),
    prisma.product.count({
      where: getProductWhere(options),
    }),
  ]);

  return {
    products: products.map(serializeProduct),
    hasMore: skip + products.length < totalCount,
    total: totalCount,
  };
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

export async function getHomeProducts() {
  const [recommendedProducts, popularProducts, onlineExclusiveProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        isOutOfStock: false,
        isRecommended: true,
      },
      orderBy: [{ recommendedOrder: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        category: true,
        imageUrl: true,
        isRecommended: true,
        isOnlineExclusive: true,
        isPopular: true,
        isOutOfStock: true,
        recommendedOrder: true,
        popularOrder: true,
        maxOrderQuantity: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        isOutOfStock: false,
        isPopular: true,
      },
      orderBy: [{ popularOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        category: true,
        imageUrl: true,
        isRecommended: true,
        isOnlineExclusive: true,
        isPopular: true,
        isOutOfStock: true,
        recommendedOrder: true,
        popularOrder: true,
        maxOrderQuantity: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        isOutOfStock: false,
        isOnlineExclusive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        category: true,
        imageUrl: true,
        isRecommended: true,
        isOnlineExclusive: true,
        isPopular: true,
        isOutOfStock: true,
        recommendedOrder: true,
        popularOrder: true,
        maxOrderQuantity: true,
      },
    }),
  ]);

  return {
    recommendedProducts: recommendedProducts.map(serializeProduct),
    popularProducts: popularProducts.map(serializeProduct),
    onlineExclusiveProducts: onlineExclusiveProducts.map(serializeProduct),
  };
}
