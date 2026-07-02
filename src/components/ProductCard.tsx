"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { usePriceData } from "@/contexts/PriceContext";
import { firstMeaningfulProductName } from "@/lib/order-item";

type Props = {
  product: Product;
  onAdd: (product: Omit<CartItem, "quantity">) => void;
  compact?: boolean;
};

function toSafePrice(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

const BADGE_META = [
  {
    key: "isRecommended",
    label: "추천상품",
    className: "bg-amber-400 text-amber-950",
  },
  {
    key: "isOnlineExclusive",
    label: "한정특가",
    className: "bg-red-500 text-white",
  },
  {
    key: "isPopular",
    label: "인기상품",
    className: "bg-emerald-500 text-white",
  },
] as const;

function ProductCard({ product, onAdd, compact = false }: Props) {
  const { priceData, loading } = usePriceData(product.barcode);
  const badges = BADGE_META.filter((badge) => Boolean(product[badge.key]));

  const dbPrice = toSafePrice(product.price);
  const displayName = firstMeaningfulProductName(priceData?.name, product.name) || "상품명 없음";
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
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm transition hover:shadow-md sm:rounded-xl overflow-hidden flex flex-col h-full">
      <div className={`relative bg-gray-50 w-full overflow-hidden ${compact ? "aspect-[6/5] sm:aspect-square" : "aspect-[5/3] sm:aspect-[4/3]"}`}>
        <ProductImage
          src={product.imageUrl}
          alt={displayName}
          fill
          sizes={compact ? "(max-width: 640px) 46vw, 150px" : "(max-width: 640px) 50vw, 260px"}
        />
        {badges.length > 0 && (
          <div className={`absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-1 sm:left-2 sm:top-2 ${compact ? "pr-8" : "pr-12"}`}>
            {badges.map((badge) => (
              <span
                key={badge.key}
                className={`rounded-full px-1.5 py-0.5 font-black shadow-sm sm:px-2 ${compact ? "text-[9px]" : "text-[9px] sm:text-xs"} ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => onAdd(cartProduct)}
          disabled={product.isOutOfStock || loadingPrice}
          className={`absolute bottom-1.5 right-1.5 rounded-lg bg-green-600 font-bold text-white shadow-md transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:bottom-2 sm:right-2 ${compact ? "min-h-[34px] px-2.5 py-1.5 text-xs sm:min-h-[36px]" : "min-h-[38px] px-3 py-2 text-xs sm:min-h-[44px] sm:px-4 sm:py-2.5 sm:text-sm"}`}
        >
          {product.isOutOfStock ? "품절" : loadingPrice ? "확인중" : "+ 담기"}
        </button>
      </div>

      <div className={`${compact ? "p-1 gap-0 sm:p-1.5 sm:gap-0.5" : "p-1.5 gap-0 sm:p-3 sm:gap-1"} flex flex-col flex-1`}>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.35em] ${compact ? "text-[13px] sm:text-sm" : "text-sm sm:text-[17px]"}`}>
            {displayName}
          </h3>
          {product.description && !compact && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2 hidden sm:block">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-auto pt-0.5">
          {loadingPrice ? (
            <p className={`font-bold text-green-700 ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>...</p>
          ) : hasEvent ? (
            <div className="space-y-0 sm:space-y-1">
              <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
                <span className={`${compact ? "text-[10px]" : "text-xs"} text-gray-400 line-through`}>
                  {formatPrice(normalPrice)}
                </span>
                <span className={`${compact ? "text-[10px] px-1.5" : "text-xs px-2"} font-bold text-red-500 bg-red-50 py-0.5 rounded-full`}>
                  {discountRate}% 할인
                </span>
              </div>
              <p className={`font-black text-green-700 tracking-normal ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>
                {formatPrice(eventPrice)}
              </p>
            </div>
          ) : (
            <p className={`font-black text-green-700 tracking-normal ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>
              {formatPrice(normalPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
