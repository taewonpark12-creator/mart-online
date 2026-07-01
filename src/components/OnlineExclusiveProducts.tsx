"use client";

import type { CartItem, Product } from "@/lib/types";
import { HomeProductSection } from "@/components/HomeProductSection";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

export function OnlineExclusiveProducts({ products, onAdd }: Props) {
  const exclusiveProducts = products.filter((p) => p.isOnlineExclusive);

  return <HomeProductSection title="한정특가" products={exclusiveProducts} onAdd={onAdd} />;
}
