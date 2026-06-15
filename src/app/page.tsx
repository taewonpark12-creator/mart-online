"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { OnlineExclusiveProducts } from "@/components/OnlineExclusiveProducts";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { PopularProducts } from "@/components/PopularProducts";
import { OrderBar } from "@/components/OrderBar";
import { FlyerBanner } from "@/components/FlyerBanner";
import { useCart } from "@/contexts/CartContext";
import { PriceProvider } from "@/contexts/PriceContext";
import type { CartItem, Product } from "@/lib/types";
import { CATEGORIES, MIN_ORDER_AMOUNT, formatPrice } from "@/lib/types";

const PRODUCT_LOAD_ERROR_MESSAGE = "상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
const PRODUCT_FETCH_TIMEOUT_MS = 10000;
const INITIAL_VISIBLE_SEARCH_COUNT = 60;

export default function HomePage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [homeProducts, setHomeProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [exclusiveProducts, setExclusiveProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "전체");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleSearchCount, setVisibleSearchCount] = useState(INITIAL_VISIBLE_SEARCH_COUNT);
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const { addItem, syncWithProducts, totalAmount, totalCount } = useCart();
  const fetchCount = useRef(0);
  const isSearchMode = debouncedSearch.length > 0;
  const categoryProducts =
    category === CATEGORIES[0]
      ? allProducts
      : allProducts.filter((product) => product.category === category);
  const visibleSearchResults = searchResults.slice(0, visibleSearchCount);
  const hasMoreSearchResults = visibleSearchCount < searchResults.length;
  const visibleCategories = (CATEGORIES as readonly string[]).filter((item) => item !== CATEGORIES[0]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setVisibleSearchCount(INITIAL_VISIBLE_SEARCH_COUNT);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast({ show: false, message: "" }), 2000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const fetchProducts = useCallback(async () => {
    fetchCount.current += 1;
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[fetchProducts] request: ${fetchCount.current}`);
    }

    setLoading(true);
    setProductError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);

    try {
      if (isSearchMode) {
        const params = new URLSearchParams({ q: debouncedSearch });
        const res = await fetch(`/api/products?${params.toString()}`, { signal: controller.signal });

        if (!res.ok) {
          throw new Error("Failed to load search results");
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : [];
        setSearchResults(results);
        syncWithProducts(results);
        return;
      }

      const [allRes, homeRes, popularRes, exclusiveRes] = await Promise.all([
        fetch("/api/products", { signal: controller.signal }),
        fetch("/api/products?recommended=true", { signal: controller.signal }),
        fetch("/api/products?popular=true", { signal: controller.signal }),
        fetch("/api/products?onlineExclusive=true", { signal: controller.signal }),
      ]);

      if (!allRes.ok || !homeRes.ok || !popularRes.ok || !exclusiveRes.ok) {
        throw new Error("Failed to load home products");
      }

      const [allRaw, homeRaw, popularRaw, exclusiveRaw] = await Promise.all([
        allRes.json(),
        homeRes.json(),
        popularRes.json(),
        exclusiveRes.json(),
      ]);

      const nextAllProducts = Array.isArray(allRaw) ? allRaw : [];
      const nextHomeProducts = Array.isArray(homeRaw) ? homeRaw : [];
      const nextPopularProducts = Array.isArray(popularRaw) ? popularRaw : [];
      const nextExclusiveProducts = Array.isArray(exclusiveRaw) ? exclusiveRaw : [];

      setAllProducts(nextAllProducts);
      setHomeProducts(nextHomeProducts);
      setPopularProducts(nextPopularProducts);
      setExclusiveProducts(nextExclusiveProducts);
      setSearchResults([]);
      syncWithProducts(nextAllProducts);
    } catch (error) {
      setProductError(PRODUCT_LOAD_ERROR_MESSAGE);
      if (process.env.NODE_ENV !== "production") {
        console.warn("상품 로딩 실패:", error);
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [debouncedSearch, isSearchMode, syncWithProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAdd = useCallback((product: Omit<CartItem, "quantity">) => {
    const result = addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      normalPrice: product.normalPrice,
      eventPrice: product.eventPrice,
      discountRate: product.discountRate,
      isOutOfStock: product.isOutOfStock,
      maxOrderQuantity: product.maxOrderQuantity,
    });

    setToast({
      show: true,
      message: result.success ? "장바구니에 추가했습니다." : result.message || "추가에 실패했습니다.",
    });
  }, [addItem]);

  const handleCategoryChange = useCallback((nextCategory: string) => {
    setCategory(nextCategory);
    setSearch("");
    setDebouncedSearch("");
  }, []);

  return (
    <PriceProvider>
      <div className="min-h-screen bg-white">
        <Header cartCount={totalCount} />

        <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 sm:pb-28">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <a
              href="https://open.kakao.com/o/sdPlnVxi"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 hover:bg-yellow-500 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-yellow-900 border border-yellow-500"
            >
              카카오톡 1:1 문의
            </a>

            <div className="bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-emerald-700">
              숭의동, 용현동 배달
            </div>

            <div className="bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-emerald-700">
              {formatPrice(MIN_ORDER_AMOUNT)} 이상
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            <Link href="/flyers">
              <FlyerBanner onOpen={() => {}} />
            </Link>
          </div>

          <div className="relative mb-4 sm:mb-6">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base">
              검색
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="상품명 검색"
              className="w-full h-10 sm:h-12 pl-14 sm:pl-16 pr-10 sm:pr-12 bg-gray-50 border-none rounded-xl sm:rounded-2xl text-gray-800 text-sm sm:text-base focus:ring-2 focus:ring-emerald-500 transition-all"
              aria-label="상품 검색"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                }}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="검색어 지우기"
              >
                x
              </button>
            )}
          </div>

          <div className="mb-4 sm:mb-6 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {visibleCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleCategoryChange(item)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs sm:text-sm font-semibold transition ${
                    category === item
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {productError && !loading && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{productError}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm border border-red-100"
              >
                다시 시도
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="h-32 bg-gray-50 rounded-3xl animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-48 bg-gray-50 rounded-3xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : isSearchMode ? (
            searchResults.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mt-8 mb-4">
                  <span className="w-8 h-1 bg-gray-200 rounded-full" />
                  <h2 className="text-lg font-bold text-gray-900">검색 결과</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {visibleSearchResults.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleAdd} />
                  ))}
                </div>
                {hasMoreSearchResults && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleSearchCount((count) => count + INITIAL_VISIBLE_SEARCH_COUNT)}
                      className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold min-h-[44px]"
                    >
                      더 보기
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-gray-400">검색 결과가 없습니다.</div>
            )
          ) : (
            <>
              {category === CATEGORIES[0] && (
                <>
                  <div className="mb-8">
                    <RecommendedProducts products={homeProducts} onAdd={handleAdd} />
                  </div>

                  <OnlineExclusiveProducts products={exclusiveProducts} onAdd={handleAdd} />

                  {popularProducts.length > 0 && (
                    <div className="mb-8">
                      <PopularProducts products={popularProducts} onAdd={handleAdd} />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 mt-8 mb-4">
                <span className="w-8 h-1 bg-gray-200 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">
                  {category === CATEGORIES[0] ? "전체 상품" : category}
                </h2>
              </div>

              {categoryProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleAdd} />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400">표시할 상품이 없습니다.</div>
              )}

            </>
          )}
        </main>

        {toast.show && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
              {toast.message}
            </div>
          </div>
        )}

        <OrderBar
          itemCount={totalCount}
          totalAmount={totalAmount}
          onOrderClick={() => {
            window.location.href = "/cart";
          }}
        />
      </div>
    </PriceProvider>
  );
}
