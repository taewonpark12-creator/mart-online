"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/lib/types";

const CART_KEY = "mart_cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        const maxLimit = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : Infinity;
        const newQuantity = Math.min(existing.quantity + 1, maxLimit);
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: newQuantity } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      
      const maxLimit = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : Infinity;
      const newQuantity = Math.min(quantity, maxLimit);
      
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: newQuantity } : i));
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncWithProducts = useCallback(
    (products: { id: string; name: string; price: number; imageUrl: string | null; maxOrderQuantity?: number | null }[]) => {
      const map = new Map(products.map((p) => [p.id, p]));
      setItems((prev) =>
        prev
          .filter((i) => map.has(i.productId))
          .map((i) => {
            const p = map.get(i.productId)!;
            const maxLimit = p.maxOrderQuantity && p.maxOrderQuantity > 0 ? p.maxOrderQuantity : Infinity;
            const adjustedQuantity = Math.min(i.quantity, maxLimit);
            return {
              ...i,
              name: p.name,
              price: p.price,
              imageUrl: p.imageUrl,
              maxOrderQuantity: p.maxOrderQuantity,
              quantity: adjustedQuantity,
            };
          })
      );
    },
    []
  );

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    syncWithProducts,
    totalAmount,
    totalCount,
    loaded,
  };
}
