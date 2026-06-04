"use client";

import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";

type Props = {
  product: Product;
  onAdd: () => void;
};

export function ProductCard({ product, onAdd }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
      <div className="relative bg-gray-50 h-32 sm:h-36 w-full">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          fill
          className="rounded-none"
          sizes="(max-width: 640px) 50vw, 240px"
        />
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5 sm:gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] sm:text-xs text-green-600 font-medium bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full inline-block">
              {product.category}
            </span>
            <h3 className="font-semibold text-gray-900 mt-1 leading-snug text-sm sm:text-base truncate">{product.name}</h3>
            {product.description && (
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2 hidden sm:block">{product.description}</p>
            )}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="font-bold text-green-700 text-base sm:text-lg">{formatPrice(product.price)}</p>
          <button
            onClick={onAdd}
            className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition shrink-0"
          >
            + 담기
          </button>
        </div>
      </div>
    </div>
  );
}
