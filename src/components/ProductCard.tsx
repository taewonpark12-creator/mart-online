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
  tone?: "default" | "deal" | "popular";
};

function toSafePrice(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

const BADGE_META = [
  {
    key: "isOnlineExclusive",
    label: "특가",
    className: "bg-rose-500 text-white",
  },
  {
    key: "isRecommended",
    label: "추천",
    className: "bg-amber-400 text-amber-950",
  },
  {
    key: "isPopular",
    label: "인기",
    className: "bg-emerald-500 text-white",
  },
] as const;

function ProductCard({ product, onAdd, compact = false, tone = "default" }: Props) {
  const { priceData, loading } = usePriceData(product.barcode);
  const sectionBadgeKey = compact
    ? tone === "deal"
      ? "isOnlineExclusive"
      : tone === "popular"
        ? "isPopular"
        : "isRecommended"
    : null;
  const badges = BADGE_META.filter(
    (badge) => Boolean(product[badge.key]) && badge.key !== sectionBadgeKey,
  ).slice(0, 1);

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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition duration-200 hover:border-emerald-200 hover:shadow-[0_5px_14px_rgba(15,23,42,0.09)]">
      <div className={`relative w-full overflow-hidden bg-slate-50 ${compact ? "aspect-[6/5] sm:aspect-square" : "aspect-[5/3] sm:aspect-[4/3]"}`}>
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
                className={`rounded-md px-1.5 py-1 font-extrabold leading-none shadow-[0_1px_4px_rgba(15,23,42,0.14)] sm:px-2 ${compact ? "text-[9px]" : "text-[9px] sm:text-[11px]"} ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => onAdd(cartProduct)}
          disabled={product.isOutOfStock || loadingPrice}
          className={`absolute bottom-1.5 right-1.5 rounded-lg bg-emerald-600/95 font-extrabold text-white shadow-[0_3px_10px_rgba(5,150,105,0.3)] ring-1 ring-white/80 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:bottom-2 sm:right-2 ${compact ? "min-h-[38px] px-2 py-1.5 text-[13px] sm:px-2.5" : "min-h-[38px] px-2.5 py-1.5 text-xs sm:min-h-[42px] sm:px-3.5 sm:py-2 sm:text-sm"}`}
        >
          {product.isOutOfStock ? "품절" : loadingPrice ? "확인중" : "+ 담기"}
        </button>
      </div>

      <div className={`${compact ? "gap-0 px-1.5 py-1.5 sm:gap-0.5 sm:px-2 sm:py-1.5" : "gap-0 px-2 py-2 sm:gap-1 sm:p-3"} flex flex-1 flex-col`}>
        <div className="flex-1 min-w-0">
          <h3 className={`line-clamp-2 min-h-[2.35em] font-semibold leading-[1.38] tracking-[-0.005em] text-slate-900 ${compact ? "text-[13px] sm:text-sm" : "text-sm sm:text-[17px]"}`}>
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
            <p className={`font-extrabold leading-tight text-slate-700 ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>...</p>
          ) : hasEvent ? (
            <div className="space-y-0.5">
              <div className={`flex min-w-0 items-center ${compact ? "gap-1" : "gap-2"}`}>
                <span className={`${compact ? "text-[9px] sm:text-[10px]" : "text-xs"} truncate text-slate-400 line-through`}>
                  {formatPrice(normalPrice)}
                </span>
                <span className={`${compact ? "px-1 text-[9px] sm:text-[10px]" : "px-1.5 text-xs"} shrink-0 rounded bg-rose-50 py-0.5 font-extrabold text-rose-600`}>
                  -{discountRate}%
                </span>
              </div>
              <p className={`font-black leading-tight tracking-[-0.025em] text-rose-600 ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>
                {formatPrice(eventPrice)}
              </p>
            </div>
          ) : (
            <p className={`font-black leading-tight tracking-[-0.025em] text-slate-900 ${compact ? "text-base sm:text-[17px]" : "text-[17px] sm:text-[21px]"}`}>
              {formatPrice(normalPrice)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
