"use client";

import type { CartItem, Product } from "@/lib/types";
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
