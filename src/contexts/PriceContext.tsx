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
      return response.json() as Promise<PriceData[]>;
    })
    .then((items) => {
      const next = new Map<string, PriceData>();
      for (const item of items) {
        next.set(String(item.barcode).trim(), item);
      }
      cachedPriceMap = next;
      return next;
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
      .catch((error) => {
        console.error("prices.json 조회 실패:", error);
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
