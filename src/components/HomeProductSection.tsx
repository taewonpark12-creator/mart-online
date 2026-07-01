"use client";

import type { CartItem, Product } from "@/lib/types";
import { HorizontalScrollHint } from "@/components/HorizontalScrollHint";
import ProductCard from "@/components/ProductCard";

type Props = {
  title: string;
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

const HOME_PRODUCT_RAIL_CLASS =
  "grid auto-cols-[calc((100%_-_0.625rem)/2.08)] grid-flow-col grid-rows-3 gap-2.5 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory sm:auto-cols-[calc((100%_-_1.5rem)/3.08)] sm:gap-3 md:auto-cols-[8.75rem]";

export function HomeProductSection({ title, products, onAdd }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="mb-5 sm:mb-8">
      <div className="mb-2.5 flex items-center gap-2 sm:mb-4">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
        <h2 className="text-base font-bold text-gray-900 sm:text-xl">{title}</h2>
      </div>

      <HorizontalScrollHint className={HOME_PRODUCT_RAIL_CLASS}>
        {products.map((product) => (
          <div key={product.id} className="min-w-0 snap-start">
            <ProductCard product={product} onAdd={onAdd} compact />
          </div>
        ))}
      </HorizontalScrollHint>
    </section>
  );
}
