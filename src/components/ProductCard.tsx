"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { usePriceData } from "@/contexts/PriceContext";

type Props = {
  product: Product;
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

function toSafePrice(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function ProductCard({ product, onAdd }: Props) {
  const { priceData, loading } = usePriceData(product.barcode);

  const dbPrice = toSafePrice(product.price);
  const displayName = priceData?.name || product.name || "상품명 없음";
  const normalPrice = priceData ? toSafePrice(priceData.normalPrice, dbPrice) : dbPrice;
  const eventPrice =
    priceData?.eventPrice !== null && priceData?.eventPrice !== undefined
      ? toSafePrice(priceData.eventPrice, 0)
      : null;
  const discountRate =
    priceData?.discountRate !== null && priceData?.discountRate !== undefined
      ? toSafePrice(priceData.discountRate, 0)
      : eventPrice && eventPrice > 0 && eventPrice < normalPrice
        ? Math.round((1 - eventPrice / normalPrice) * 100)
        : null;
  const loadingPrice = Boolean(product.barcode) && loading;
  const hasEvent =
    !loadingPrice &&
    eventPrice !== null &&
    eventPrice !== undefined &&
    eventPrice > 0 &&
    discountRate !== null &&
    discountRate > 0;
  const cartPrice = hasEvent ? eventPrice : normalPrice;
  const cartProduct = {
    productId: product.id,
    name: displayName,
    price: cartPrice,
    imageUrl: product.imageUrl,
    normalPrice,
    eventPrice,
    discountRate,
    barcode: product.barcode,
    isOutOfStock: product.isOutOfStock,
    maxOrderQuantity: product.maxOrderQuantity,
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col h-full">
      <div className="relative bg-gray-50 h-32 sm:h-36 w-full">
        <ProductImage
          src={product.imageUrl}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 50vw, 240px"
        />
        <button
          onClick={() => onAdd(cartProduct)}
          disabled={product.isOutOfStock || loadingPrice}
          className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition shadow-lg min-h-[40px] sm:min-h-[44px]"
        >
          {product.isOutOfStock ? "품절" : loadingPrice ? "확인중" : "+ 담기"}
        </button>
      </div>

      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5 sm:gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] sm:text-xs text-green-600 font-medium bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full inline-block">
            {product.category}
          </span>
          <h3 className="font-semibold text-gray-900 mt-1 leading-snug text-sm sm:text-base line-clamp-2">
            {displayName}
          </h3>
          {product.description && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2 hidden sm:block">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-auto">
          {loadingPrice ? (
            <p className="font-bold text-green-700 text-base sm:text-lg">...</p>
          ) : hasEvent ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(normalPrice)}
                </span>
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  {discountRate}% 할인
                </span>
              </div>
              <p className="font-bold text-green-700 text-base sm:text-lg">
                {formatPrice(eventPrice)}
              </p>
            </div>
          ) : (
            <p className="font-bold text-green-700 text-base sm:text-lg">
              {formatPrice(normalPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
