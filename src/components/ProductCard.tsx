"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { usePriceData } from "@/contexts/PriceContext";

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
      <div className={`relative bg-gray-50 w-full ${compact ? "h-24 sm:h-28" : "h-32 sm:h-36"}`}>
        <ProductImage
          src={product.imageUrl}
          alt={displayName}
          fill
          sizes={compact ? "(max-width: 640px) 33vw, 160px" : "(max-width: 640px) 50vw, 240px"}
        />
        {badges.length > 0 && (
          <div className={`absolute left-2 top-2 z-10 flex flex-wrap gap-1 ${compact ? "pr-8" : "pr-12"}`}>
            {badges.map((badge) => (
              <span
                key={badge.key}
                className={`rounded-full px-2 py-0.5 font-black shadow-sm ${compact ? "text-[9px]" : "text-[10px] sm:text-xs"} ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => onAdd(cartProduct)}
          disabled={product.isOutOfStock || loadingPrice}
          className={`absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition shadow-lg ${compact ? "min-h-[34px] px-2.5 py-1.5 text-[11px]" : "min-h-[40px] px-3 py-2 text-xs sm:min-h-[44px] sm:px-4 sm:py-2.5 sm:text-sm"}`}
        >
          {product.isOutOfStock ? "품절" : loadingPrice ? "확인중" : "+ 담기"}
        </button>
      </div>

      <div className={`${compact ? "p-2 gap-1" : "p-3 sm:p-4 gap-1.5 sm:gap-2"} flex flex-col flex-1`}>
        <div className="flex-1 min-w-0">
          <span className={`text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded-full inline-block ${compact ? "text-[9px]" : "text-[10px] sm:text-xs sm:px-2"}`}>
            {product.category}
          </span>
          <h3 className={`font-semibold text-gray-900 mt-1 leading-snug line-clamp-2 ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
            {displayName}
          </h3>
          {product.description && !compact && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2 hidden sm:block">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-auto">
          {loadingPrice ? (
            <p className={`font-bold text-green-700 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>...</p>
          ) : hasEvent ? (
            <div className="space-y-1">
              <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
                <span className={`${compact ? "text-[10px]" : "text-xs"} text-gray-400 line-through`}>
                  {formatPrice(normalPrice)}
                </span>
                <span className={`${compact ? "text-[10px] px-1.5" : "text-xs px-2"} font-bold text-red-500 bg-red-50 py-0.5 rounded-full`}>
                  {discountRate}% 할인
                </span>
              </div>
              <p className={`font-bold text-green-700 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
                {formatPrice(eventPrice)}
              </p>
            </div>
          ) : (
            <p className={`font-bold text-green-700 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
              {formatPrice(normalPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
