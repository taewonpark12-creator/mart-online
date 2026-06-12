"use client";

import type { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Product) => void;
};

export function RecommendedProducts({ products, onAdd }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-lg sm:text-xl" aria-hidden>
          ⭐
        </span>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">오늘의 추천상품</h2>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-3 sm:-mx-1 px-3 sm:px-1 scrollbar-hide snap-x snap-mandatory">
        {products.map((product) => (
          <div key={product.id} className="w-[140px] sm:w-[168px] md:w-[200px] shrink-0 snap-start">
            <ProductCard product={product} onAdd={onAdd} />
          </div>
        ))}
      </div>
    </section>
  );
}
