"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PriceData = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice: number | null;
  discountRate?: number | null;
};

type PriceContextValue = {
  pricesByBarcode: Map<string, PriceData>;
  loading: boolean;
};

const PriceContext = createContext<PriceContextValue>({
  pricesByBarcode: new Map(),
  loading: false,
});

let cachedPriceMap: Map<string, PriceData> | null = null;
let pendingPriceMap: Promise<Map<string, PriceData>> | null = null;

async function loadPriceMap() {
  if (cachedPriceMap) return cachedPriceMap;
  if (pendingPriceMap) return pendingPriceMap;

  pendingPriceMap = fetch("/prices.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("prices.json 불러오기 실패");
      }
      return response.json() as Promise<unknown>;
    })
    .then((items) => {
      const next = new Map<string, PriceData>();
      if (!Array.isArray(items)) {
        cachedPriceMap = next;
        return next;
      }

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        const priceItem = item as Partial<PriceData>;
        const barcode = String(priceItem.barcode ?? "").trim();
        const normalPrice = Number(priceItem.normalPrice);
        if (!barcode || !Number.isFinite(normalPrice)) continue;

        next.set(barcode, {
          barcode,
          name: typeof priceItem.name === "string" ? priceItem.name : undefined,
          normalPrice,
          eventPrice:
            priceItem.eventPrice !== null && priceItem.eventPrice !== undefined
              ? Number(priceItem.eventPrice)
              : null,
          discountRate:
            priceItem.discountRate !== null && priceItem.discountRate !== undefined
              ? Number(priceItem.discountRate)
              : null,
        });
      }
      cachedPriceMap = next;
      return next;
    })
    .catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("prices.json 조회 실패. DB 가격으로 표시합니다.", error);
      }
      const fallback = new Map<string, PriceData>();
      cachedPriceMap = fallback;
      return fallback;
    })
    .finally(() => {
      pendingPriceMap = null;
    });

  return pendingPriceMap;
}

export function PriceProvider({ children }: { children: ReactNode }) {
  const [pricesByBarcode, setPricesByBarcode] = useState<Map<string, PriceData>>(
    () => cachedPriceMap ?? new Map(),
  );
  const [loading, setLoading] = useState(!cachedPriceMap);

  useEffect(() => {
    let isMounted = true;

    loadPriceMap()
      .then((priceMap) => {
        if (isMounted) {
          setPricesByBarcode(priceMap);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ pricesByBarcode, loading }),
    [pricesByBarcode, loading],
  );

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

export function usePriceData(barcode: string | null | undefined) {
  const { pricesByBarcode, loading } = useContext(PriceContext);
  const normalizedBarcode = barcode?.trim();

  return {
    priceData: normalizedBarcode ? pricesByBarcode.get(normalizedBarcode) ?? null : null,
    loading,
  };
}
