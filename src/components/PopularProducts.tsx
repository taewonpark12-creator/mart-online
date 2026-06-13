"use client";

import type { CartItem, Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

export function PopularProducts({ products, onAdd }: Props) {
  if (products.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔥</span>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">인기상품</h2>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-3 sm:-mx-1 px-3 sm:px-1 scrollbar-hide snap-x snap-mandatory">
        {products.map((product) => (
          <div key={product.id} className="w-[140px] sm:w-[168px] md:w-[200px] shrink-0 snap-start">
            <ProductCard product={product} onAdd={onAdd} />
          </div>
        ))}
      </div>
    </div>
  );
}
