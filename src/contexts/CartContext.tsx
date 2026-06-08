"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import type { CartItem } from "@/lib/types";

const CART_KEY = "mart_cart";

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => { success: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => { success: boolean; message?: string };
  removeItem: (productId: string) => void;
  clearCart: () => void;
  syncWithProducts: (products: { id: string; name: string; price: number; imageUrl: string | null; maxOrderQuantity?: number | null }[]) => void;
  totalAmount: number;
  totalCount: number;
  loaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
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
    let result: { success: boolean; message?: string } = { success: true };
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        const maxLimit = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : Infinity;
        if (existing.quantity >= maxLimit) {
          result = { success: false, message: `이 상품은 최대 ${maxLimit}개까지 구매 가능합니다.` };
          return prev;
        }
        const newQuantity = existing.quantity + 1;
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: newQuantity } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    return result;
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    let result: { success: boolean; message?: string } = { success: true };
    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      
      // 최소 수량 1로 제한 (삭제 방지)
      if (quantity <= 0) {
        quantity = 1;
        result = { success: false, message: "최소 수량은 1개입니다." };
        return prev;
      }
      
      const maxLimit = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : Infinity;
      if (quantity > maxLimit) {
        result = { success: false, message: `이 상품은 최대 ${maxLimit}개까지 구매 가능합니다.` };
        return prev;
      }
      
      return prev.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    });
    return result;
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncWithProducts = useCallback((
    products: { id: string; name: string; price: number; imageUrl: string | null; maxOrderQuantity?: number | null }[]
  ) => {
    const map = new Map(products.map((p) => [p.id, p]));
    setItems((prev) =>
      prev.map((i) => {
        const p = map.get(i.productId);
        if (p) {
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
        }
        return i;
      })
    );
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      syncWithProducts,
      totalAmount,
      totalCount,
      loaded,
    }),
    [items, addItem, updateQuantity, removeItem, clearCart, syncWithProducts, totalAmount, totalCount, loaded]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
