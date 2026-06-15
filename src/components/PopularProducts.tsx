"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import { HorizontalScrollHint } from "@/components/HorizontalScrollHint";
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
      <HorizontalScrollHint className="grid auto-cols-[7.5rem] grid-flow-col grid-rows-3 gap-3 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory sm:auto-cols-[8.5rem] md:auto-cols-[9.5rem]">
        {products.map((product) => (
          <div key={product.id} className="min-w-0 snap-start">
            <ProductCard product={product} onAdd={onAdd} compact />
          </div>
        ))}
      </HorizontalScrollHint>
    </div>
  );
}

export const PopularProducts = React.memo(PopularProductsComponent);
