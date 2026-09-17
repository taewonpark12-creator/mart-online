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
  "grid auto-cols-[calc((100%_-_0.375rem)/2.08)] grid-flow-col grid-rows-3 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 snap-x snap-mandatory sm:auto-cols-[calc((100%_-_1rem)/3.12)] sm:gap-2 md:auto-cols-[8.75rem]";

const TONE_CLASS = {
  default: {
    box: "border-emerald-100/80 bg-gradient-to-b from-emerald-50/80 to-white shadow-[0_10px_28px_-24px_rgba(5,150,105,0.55)]",
    point: "bg-emerald-500",
    label: "추천",
    labelClass: "border-emerald-100 bg-white/90 text-emerald-700",
  },
  deal: {
    box: "border-rose-100/90 bg-gradient-to-b from-rose-50/80 to-white shadow-[0_10px_28px_-24px_rgba(225,29,72,0.45)]",
    point: "bg-rose-500",
    label: "특가",
    labelClass: "border-rose-100 bg-white/90 text-rose-600",
  },
  popular: {
    box: "border-amber-100/90 bg-gradient-to-b from-amber-50/75 to-white shadow-[0_10px_28px_-24px_rgba(217,119,6,0.4)]",
    point: "bg-amber-500",
    label: "인기",
    labelClass: "border-amber-100 bg-white/90 text-amber-700",
  },
} as const;

export function HomeProductSection({ title, products, onAdd, tone = "default" }: Props) {
  if (products.length === 0) return null;
  const style = TONE_CLASS[tone];

  return (
    <section className={`mb-8 rounded-2xl border px-3 py-3.5 sm:mb-10 sm:px-4 sm:py-4 ${style.box}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-4 w-1 rounded-full sm:h-5 ${style.point}`} aria-hidden />
          <h2 className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-slate-900 sm:text-xl">
            {title}
          </h2>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold sm:text-[11px] ${style.labelClass}`}>
          {style.label}
        </span>
      </div>

      <HorizontalScrollHint className={HOME_PRODUCT_RAIL_CLASS}>
        {products.map((product) => (
          <div key={product.id} className="min-w-0 snap-start">
            <ProductCard product={product} onAdd={onAdd} compact tone={tone} />
          </div>
        ))}
      </HorizontalScrollHint>
    </section>
  );
}
