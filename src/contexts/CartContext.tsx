"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem } from "@/lib/types";

const CART_KEY = "mart_cart";
const OUT_OF_STOCK_MESSAGE = "품절된 상품은 장바구니에 담을 수 없습니다.";

type CartProductInput = Omit<CartItem, "quantity">;
type ProductSyncItem = {
  id: string;
  name: string;
  price: number;
  barcode?: string | null;
  imageUrl: string | null;
  isOutOfStock?: boolean;
  maxOrderQuantity?: number | null;
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartProductInput) => { success: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => { success: boolean; message?: string };
  removeItem: (productId: string) => void;
  clearCart: () => void;
  syncWithProducts: (products: ProductSyncItem[]) => void;
  totalAmount: number;
  totalCount: number;
  loaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getMaxLimit(maxOrderQuantity?: number | null) {
  return maxOrderQuantity && maxOrderQuantity > 0 ? maxOrderQuantity : Infinity;
}

function isValidPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function normalizeQuantity(quantity: number, maxLimit: number) {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { quantity: 1, changed: true, message: "수량은 1개 이상 정수로 입력해주세요." };
  }

  if (quantity > maxLimit) {
    return {
      quantity: maxLimit,
      changed: true,
      message: `해당 상품은 최대 ${maxLimit}개까지 구매 가능합니다.`,
    };
  }

  return { quantity, changed: false, message: undefined };
}

function sanitizeCartItem(item: unknown): CartItem | null {
  if (!item || typeof item !== "object") return null;

  const candidate = item as CartItem;
  const price = Number(candidate.price);
  const quantity = Number(candidate.quantity);

  if (!candidate.productId || !candidate.name || !Number.isFinite(price) || price < 0) {
    return null;
  }

  return {
    ...candidate,
    price,
    quantity: isValidPositiveInteger(quantity) ? quantity : 1,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed.map(sanitizeCartItem).filter((item): item is CartItem => item !== null));
        }
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem = useCallback((item: CartProductInput) => {
    let result: { success: boolean; message?: string } = { success: true };

    if (item.isOutOfStock) {
      return { success: false, message: OUT_OF_STOCK_MESSAGE };
    }

    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      return { success: false, message: "상품 가격을 확인할 수 없습니다. 새로고침 후 다시 시도해주세요." };
    }

    const syncedItem = { ...item, price };

    setItems((prev) => {
      const existing = prev.find((i) => i.productId === syncedItem.productId);

      if (existing) {
        const maxLimit = getMaxLimit(syncedItem.maxOrderQuantity);
        const currentQuantity = isValidPositiveInteger(Number(existing.quantity)) ? Number(existing.quantity) : 1;
        const next = normalizeQuantity(currentQuantity + 1, maxLimit);

        if (next.changed && next.quantity <= currentQuantity) {
          result = { success: false, message: next.message };
          return prev;
        }

        return prev.map((i) =>
          i.productId === syncedItem.productId ? { ...i, ...syncedItem, quantity: next.quantity } : i,
        );
      }

      return [...prev, { ...syncedItem, quantity: 1 }];
    });

    return result;
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    let result: { success: boolean; message?: string } = { success: true };

    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;

      const maxLimit = getMaxLimit(item.maxOrderQuantity);
      const next = normalizeQuantity(Number(quantity), maxLimit);

      if (next.changed) {
        result = { success: false, message: next.message };
      }

      return prev.map((i) => (i.productId === productId ? { ...i, quantity: next.quantity } : i));
    });

    return result;
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncWithProducts = useCallback((products: ProductSyncItem[]) => {
    const map = new Map(products.map((p) => [p.id, p]));

    setItems((prev) =>
      prev.map((i) => {
        const p = map.get(i.productId);
        if (!p) return i;

        const maxLimit = getMaxLimit(p.maxOrderQuantity);
        const adjustedQuantity = normalizeQuantity(Number(i.quantity), maxLimit).quantity;
        const currentPrice = Number(i.price);

        return {
          ...i,
          name: i.name || p.name,
          price: Number.isFinite(currentPrice) && currentPrice >= 0 ? currentPrice : Number(p.price),
          barcode: p.barcode ?? i.barcode,
          imageUrl: p.imageUrl,
          isOutOfStock: p.isOutOfStock,
          maxOrderQuantity: p.maxOrderQuantity,
          quantity: adjustedQuantity,
        };
      }),
    );
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const totalCount = items.reduce((sum, i) => sum + Number(i.quantity), 0);

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
    [items, addItem, updateQuantity, removeItem, clearCart, syncWithProducts, totalAmount, totalCount, loaded],
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
