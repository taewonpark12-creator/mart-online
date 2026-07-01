"use client";

import type { CartItem, Product } from "@/lib/types";
import { HomeProductSection } from "@/components/HomeProductSection";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

export function RecommendedProducts({ products, onAdd }: Props) {
  return <HomeProductSection title="오늘의 추천상품" products={products} onAdd={onAdd} />;
}
