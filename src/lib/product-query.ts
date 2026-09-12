import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { HOME_PRODUCTS_CACHE_TAG } from "@/lib/home-products-cache";
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
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type CustomerCategoryProductRow = ProductWithPrice & {
  id: string;
  name: string;
  barcode: string | null;
  category: string;
  imageUrl: string | null;
  isRecommended: boolean;
  isOnlineExclusive: boolean;
  isPopular: boolean;
  isOutOfStock: boolean;
  recommendedOrder: number;
  popularOrder: number;
  maxOrderQuantity: number | null;
};

export function serializeProduct<T extends ProductWithPrice>(product: T) {
  return {
    ...product,
    price: product.price.toString(),
    createdAt: product.createdAt?.toISOString() ?? null,
    updatedAt: product.updatedAt?.toISOString() ?? null,
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

  // Trim category to handle potential whitespace issues
  const trimmedCategory = category.trim();

  const baseConditions = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(recommendedOnly ? { isRecommended: true } : {}),
    ...(excludeRecommended ? { isRecommended: false } : {}),
    ...(popularOnly ? { isPopular: true } : {}),
    ...(onlineExclusiveOnly ? { isOnlineExclusive: true } : {}),
    ...(outOfStockOnly ? { isOutOfStock: true } : {}),
    ...(!outOfStockOnly && !includeOutOfStock ? { isOutOfStock: false } : {}),
  };

  if (q) {
    return {
      ...baseConditions,
      AND: [
        ...(trimmedCategory && trimmedCategory !== "전체" ? [{ category: trimmedCategory }] : []),
        {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        },
      ],
    };
  }

  return {
    ...baseConditions,
    ...(trimmedCategory && trimmedCategory !== "전체" ? { category: trimmedCategory } : {}),
  };
}

function getProductOrderBy(options: ProductListOptions): Prisma.ProductOrderByWithRelationInput[] {
  if (options.recommendedOnly) {
    return [{ recommendedOrder: "desc" }, { name: "asc" }];
  }

  return [{ category: "asc" }, { name: "asc" }];
}

function shouldUseCustomerCategoryPrioritySort(options: ProductListOptions) {
  const category = options.category?.trim() ?? "";

  return (
    Boolean(category) &&
    category !== "전체" &&
    !options.q &&
    options.customerSearchFieldsOnly === true &&
    options.activeOnly !== false &&
    !options.recommendedOnly &&
    !options.excludeRecommended &&
    !options.popularOnly &&
    !options.onlineExclusiveOnly &&
    !options.outOfStockOnly &&
    !options.includeOutOfStock
  );
}

export async function findProducts(options: ProductListOptions = {}) {
  const page = options.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  if (shouldUseCustomerCategoryPrioritySort(options)) {
    const category = options.category?.trim() ?? "";
    const [products, totalCount] = await Promise.all([
      prisma.$queryRaw<CustomerCategoryProductRow[]>(Prisma.sql`
        SELECT
          "id",
          "name",
          "barcode",
          "price",
          "category",
          "imageUrl",
          "isRecommended",
          "isOnlineExclusive",
          "isPopular",
          "isOutOfStock",
          "recommendedOrder",
          "popularOrder",
          "maxOrderQuantity"
        FROM "Product"
        WHERE
          "isActive" = true
          AND "isOutOfStock" = false
          AND "category" = ${category}
        ORDER BY
          CASE
            WHEN "isRecommended" = true THEN 1
            WHEN "isPopular" = true THEN 2
            ELSE 3
          END ASC,
          "name" ASC
        OFFSET ${skip}
        LIMIT ${PAGE_SIZE}
      `),
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

export async function findProductsForAdmin(options: Omit<ProductListOptions, 'customerSearchFieldsOnly'> = {}) {
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  const whereClause = getProductWhere(options);
  const orderBy = getProductOrderBy(options);

  console.log('[DEBUG] findProductsForAdmin - Options:', options);
  console.log('[DEBUG] findProductsForAdmin - Where clause:', JSON.stringify(whereClause, null, 2));
  console.log('[DEBUG] findProductsForAdmin - OrderBy:', JSON.stringify(orderBy, null, 2));
  console.log('[DEBUG] findProductsForAdmin - Pagination:', { page, skip, take: PAGE_SIZE });

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      orderBy: orderBy,
      skip,
      take: PAGE_SIZE,
    }),
    prisma.product.count({
      where: whereClause,
    }),
  ]);

  console.log('[DEBUG] findProductsForAdmin - Result:', {
    productsReturned: products.length,
    totalCount,
    hasMore: skip + products.length < totalCount,
  });

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

async function queryHomeProducts() {
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

export const getHomeProducts = unstable_cache(queryHomeProducts, [HOME_PRODUCTS_CACHE_TAG], {
  tags: [HOME_PRODUCTS_CACHE_TAG],
  revalidate: false,
});
