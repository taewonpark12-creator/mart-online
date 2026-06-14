"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

function PopularProductsComponent({ products, onAdd }: Props) {
  if (products.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔥</span>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">인기상품</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {products.map((product) => (
          <div key={product.id} className="min-w-0">
            <ProductCard product={product} onAdd={onAdd} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const PopularProducts = React.memo(PopularProductsComponent);
