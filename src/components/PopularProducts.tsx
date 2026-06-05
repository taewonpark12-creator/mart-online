"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Product) => void;
};

export function PopularProducts({ products, onAdd }: Props) {
  if (products.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔥</span>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">인기상품</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={() => onAdd(product)} />
        ))}
      </div>
    </div>
  );
}
