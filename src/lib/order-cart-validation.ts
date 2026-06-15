import { prisma } from "@/lib/prisma";
import { MIN_ORDER_AMOUNT } from "@/lib/types";
import {
  getSyncedProductInfo,
  loadPriceSource,
  type PriceItem,
} from "@/lib/order-pricing";

export type SubmittedOrderItem = {
  productId?: unknown;
  barcode?: unknown;
  name?: unknown;
  price?: unknown;
  quantity?: unknown;
};

export class OrderValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly productId?: string,
    readonly updatedCart?: unknown,
    readonly priceSourceVersion?: string,
  ) {
    super(message);
  }
}

export function parseSubmittedItem(item: SubmittedOrderItem) {
  if (!item || typeof item !== "object") {
    throw new OrderValidationError("INVALID_ORDER", "주문 상품 형식이 올바르지 않습니다.");
  }

  const productId = typeof item.productId === "string" ? item.productId.trim() : "";
  const barcode = typeof item.barcode === "string" ? item.barcode.trim() : null;

  if (!productId) {
    throw new OrderValidationError("INVALID_ORDER", "유효하지 않은 상품이 포함되어 있습니다.");
  }

  if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.price)) {
    throw new OrderValidationError("INVALID_ORDER", "상품 가격을 다시 확인해주세요.", 400, productId);
  }

  if (
    typeof item.quantity !== "number" ||
    !Number.isFinite(item.quantity) ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    throw new OrderValidationError("INVALID_ORDER", "상품 수량을 다시 확인해주세요.", 400, productId);
  }

  return { productId, barcode, price: item.price, quantity: item.quantity };
}

export async function validateSubmittedCart(rawItems: unknown) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderValidationError("INVALID_ORDER", "주문 상품이 없습니다.");
  }

  const { priceMap, priceSourceVersion } = await loadPriceSource();
  const submittedItems = rawItems.map((item) => parseSubmittedItem(item as SubmittedOrderItem));
  const productIds = submittedItems.map((item) => item.productId);

  if (new Set(productIds).size !== productIds.length) {
    throw new OrderValidationError(
      "INVALID_ORDER",
      "중복된 상품이 포함되어 있습니다. 장바구니를 다시 확인해주세요.",
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  if (products.length !== productIds.length) {
    throw new OrderValidationError("INVALID_ORDER", "유효하지 않은 상품이 포함되어 있습니다.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  let totalAmount = 0;
  const updatedCart = [];
  const orderItems = [];
  let minimumOrderWarning: string | null = null;

  for (const item of submittedItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new OrderValidationError("INVALID_ORDER", "유효하지 않은 상품이 포함되어 있습니다.", 400, item.productId);
    }

    const currentBarcode = product.barcode?.trim() || null;
    if (currentBarcode && item.barcode !== currentBarcode) {
      throw new OrderValidationError(
        "INVALID_ORDER",
        "상품 정보가 변경되었습니다. 장바구니를 다시 확인해주세요.",
        400,
        product.id,
      );
    }
    if (!currentBarcode && item.barcode) {
      throw new OrderValidationError(
        "INVALID_ORDER",
        "상품 정보가 변경되었습니다. 장바구니를 다시 확인해주세요.",
        400,
        product.id,
      );
    }

    const maxOrderQuantity =
      product.maxOrderQuantity && product.maxOrderQuantity > 0 ? product.maxOrderQuantity : null;
    if (maxOrderQuantity && item.quantity > maxOrderQuantity) {
      throw new OrderValidationError(
        "INVALID_ORDER",
        `해당 상품은 최대 ${maxOrderQuantity}개까지 구매 가능합니다.`,
        400,
        product.id,
      );
    }

    const synced = getSyncedProductInfo(product, priceMap as Map<string, PriceItem>);
    updatedCart.push({
      productId: product.id,
      name: synced.name,
      price: item.price,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      quantity: item.quantity,
      normalPrice: synced.normalPrice,
      eventPrice: synced.eventPrice,
      discountRate: synced.discountRate,
      isOutOfStock: product.isOutOfStock,
      maxOrderQuantity: product.maxOrderQuantity,
    });

    const lineTotal = item.price * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) {
      throw new OrderValidationError("INVALID_ORDER", "주문 금액을 다시 확인해주세요.", 400, product.id);
    }

    totalAmount += lineTotal;
    if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
      throw new OrderValidationError("INVALID_ORDER", "주문 금액을 다시 확인해주세요.", 400, product.id);
    }
    orderItems.push({
      productId: product.id,
      productName: synced.name,
      quantity: item.quantity,
      unitPrice: item.price,
    });
  }

  if (totalAmount < MIN_ORDER_AMOUNT) {
    minimumOrderWarning = `최소 주문 금액 ${MIN_ORDER_AMOUNT.toLocaleString("ko-KR")}원 미만 주문입니다.`;
  }

  return {
    submittedItems,
    orderItems,
    updatedCart,
    totalAmount,
    minimumOrderWarning,
    priceSourceVersion,
  };
}
