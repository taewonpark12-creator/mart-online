"use client";

import React from "react";
import type { CartItem, Product } from "@/lib/types";
import { HomeProductSection } from "@/components/HomeProductSection";

type Props = {
  products: Product[];
  onAdd: (product: Omit<CartItem, "quantity">) => void;
};

function PopularProductsComponent({ products, onAdd }: Props) {
  return <HomeProductSection title="인기상품" products={products} onAdd={onAdd} tone="popular" />;
}

export const PopularProducts = React.memo(PopularProductsComponent);
