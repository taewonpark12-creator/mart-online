import { prisma } from "@/lib/prisma";
import { MIN_ORDER_AMOUNT } from "@/lib/types";
import {
  PRICE_CHANGED_MESSAGE,
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
  const productId = typeof item.productId === "string" ? item.productId.trim() : "";
  const barcode = typeof item.barcode === "string" ? item.barcode.trim() : null;
  const price = Number(item.price);
  const quantity = Number(item.quantity);

  if (!productId) {
    throw new OrderValidationError("INVALID_ORDER", "유효하지 않은 상품이 포함되어 있습니다.");
  }
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
    throw new OrderValidationError("PRICE_CHANGED", PRICE_CHANGED_MESSAGE, 409, productId);
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new OrderValidationError("INVALID_ORDER", "상품 수량을 다시 확인해주세요.", 400, productId);
  }

  return { productId, barcode, price, quantity };
}

export async function validateSubmittedCart(
  rawItems: unknown,
  submittedTotalAmount?: unknown,
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderValidationError("INVALID_ORDER", "주문 상품이 없습니다.");
  }

  if (
    submittedTotalAmount !== undefined &&
    (!Number.isFinite(Number(submittedTotalAmount)) || Number(submittedTotalAmount) < 0)
  ) {
    throw new OrderValidationError("INVALID_ORDER", "주문 금액을 다시 확인해주세요.");
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
      price: synced.price,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      quantity: item.quantity,
      normalPrice: synced.normalPrice,
      eventPrice: synced.eventPrice,
      discountRate: synced.discountRate,
      isOutOfStock: product.isOutOfStock,
      maxOrderQuantity: product.maxOrderQuantity,
    });

    if (item.price !== synced.price) {
      throw new OrderValidationError(
        "PRICE_CHANGED",
        PRICE_CHANGED_MESSAGE,
        409,
        product.id,
        updatedCart,
        priceSourceVersion,
      );
    }

    totalAmount += synced.price * item.quantity;
    orderItems.push({
      productId: product.id,
      productName: synced.name,
      quantity: item.quantity,
      unitPrice: synced.price,
    });
  }

  if (totalAmount < MIN_ORDER_AMOUNT) {
    throw new OrderValidationError(
      "MIN_ORDER_AMOUNT_CHANGED",
      `최소 주문 금액은 ${MIN_ORDER_AMOUNT.toLocaleString("ko-KR")}원입니다.`,
      400,
      undefined,
      updatedCart,
      priceSourceVersion,
    );
  }

  if (
    submittedTotalAmount !== undefined &&
    Math.floor(Number(submittedTotalAmount)) !== totalAmount
  ) {
    throw new OrderValidationError(
      "PRICE_CHANGED",
      PRICE_CHANGED_MESSAGE,
      409,
      undefined,
      updatedCart,
      priceSourceVersion,
    );
  }

  return {
    submittedItems,
    orderItems,
    updatedCart,
    totalAmount,
    priceSourceVersion,
  };
}
