"use client";

import type { CartItem, Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

export function OnlineExclusiveProducts({ products, onAdd }: Props) {
  const exclusiveProducts = products.filter((p) => p.isOnlineExclusive);

  if (exclusiveProducts.length === 0) return null;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-xl sm:text-2xl text-purple-600" aria-hidden>
          특
        </span>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">한정특가</h2>
      </div>

      <div className="grid auto-cols-[calc((100%-1rem)/2)] grid-flow-col grid-rows-2 gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory sm:auto-cols-[calc((100%-2rem)/3)]">
        {exclusiveProducts.map((product) => (
          <div key={product.id} className="snap-start">
            <ProductCard product={product} onAdd={onAdd} />
          </div>
        ))}
      </div>
    </section>
  );
}
