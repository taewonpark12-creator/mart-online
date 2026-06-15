"use client";

import type { CartItem, Product } from "@/lib/types";
import { HorizontalScrollHint } from "@/components/HorizontalScrollHint";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
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
      <HorizontalScrollHint className="grid auto-cols-[calc((100%-1rem)/2)] grid-flow-col grid-rows-2 gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory sm:auto-cols-[calc((100%-2rem)/3)]">
        {products.map((product) => (
          <div key={product.id} className="snap-start">
            <ProductCard product={product} onAdd={onAdd} />
          </div>
        ))}
      </HorizontalScrollHint>
    </section>
  );
}
