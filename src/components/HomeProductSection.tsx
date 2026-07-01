"use client";

import type { CartItem, Product } from "@/lib/types";
import { HorizontalScrollHint } from "@/components/HorizontalScrollHint";
import ProductCard from "@/components/ProductCard";

type Props = {
  title: string;
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
  tone?: "default" | "deal" | "popular";
};

const HOME_PRODUCT_RAIL_CLASS =
  "grid auto-cols-[calc((100%_-_0.5rem)/2.16)] grid-flow-col grid-rows-3 gap-2 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory sm:auto-cols-[calc((100%_-_1.25rem)/3.14)] sm:gap-2.5 md:auto-cols-[8.25rem]";

const TONE_CLASS = {
  default: {
    box: "border-emerald-100/70 bg-emerald-50/35",
    point: "bg-emerald-500",
    label: "",
  },
  deal: {
    box: "border-orange-100/80 bg-orange-50/45",
    point: "bg-orange-500",
    label: "특가",
  },
  popular: {
    box: "border-lime-100/80 bg-lime-50/40",
    point: "bg-lime-500",
    label: "",
  },
} as const;

export function HomeProductSection({ title, products, onAdd, tone = "default" }: Props) {
  if (products.length === 0) return null;
  const style = TONE_CLASS[tone];

  return (
    <section className={`mb-6 rounded-2xl border px-2.5 py-3 sm:mb-8 sm:px-4 sm:py-4 ${style.box}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-4 w-1 rounded-full ${style.point}`} aria-hidden />
          <h2 className="truncate text-base font-bold text-gray-900 sm:text-xl">{title}</h2>
        </div>
        {style.label && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-orange-700 ring-1 ring-orange-100">
            {style.label}
          </span>
        )}
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
