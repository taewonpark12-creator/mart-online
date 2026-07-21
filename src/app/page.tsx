"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { OnlineExclusiveProducts } from "@/components/OnlineExclusiveProducts";
import { ProductImageNotice } from "@/components/ProductImageNotice";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { PopularProducts } from "@/components/PopularProducts";
import { OrderBar } from "@/components/OrderBar";
import { FlyerBanner } from "@/components/FlyerBanner";
import { useCart } from "@/contexts/CartContext";
import { PriceProvider } from "@/contexts/PriceContext";
import type { CartItem, Product } from "@/lib/types";
import { CATEGORIES, formatPrice } from "@/lib/types";
import { getMinimumOrderAmount, isMinOrderEventActive } from "@/lib/min-order";

const PRODUCT_LOAD_ERROR_MESSAGE = "상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
const PRODUCT_FETCH_TIMEOUT_MS = 10000;
const INITIAL_VISIBLE_SEARCH_COUNT = 60;

export default function HomePage() {
  const [homeProducts, setHomeProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [exclusiveProducts, setExclusiveProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "전체");
  const [hasCategorySelection, setHasCategorySelection] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryHasMore, setCategoryHasMore] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const categoryObserverRef = useRef<IntersectionObserver | null>(null);
  const searchObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { addItem, syncWithProducts, totalAmount, totalCount } = useCart();
  const minimumOrderAmount = getMinimumOrderAmount();
  const minimumOrderEventActive = isMinOrderEventActive();
  const fetchCount = useRef(0);
  const isSearchMode = debouncedSearch.length > 0;
  const visibleCategories = ["홈", ...CATEGORIES] as readonly string[];
  const isHomeView = !hasCategorySelection;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSearchPage(1);
    setSearchHasMore(false);
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
        const params = new URLSearchParams({ q: debouncedSearch, page: String(searchPage) });
        const res = await fetch(`/api/products?${params.toString()}`, { signal: controller.signal });

        if (!res.ok) {
          throw new Error("Failed to load search results");
        }

        const data = await res.json();
        const results = Array.isArray(data.products) ? data.products : [];
        const hasMore = data.hasMore ?? false;

        if (searchPage === 1) {
          setSearchResults(results);
        } else {
          setSearchResults((prev) => [...prev, ...results]);
        }
        setSearchHasMore(hasMore);
        syncWithProducts(results);
        return;
      }

      const homeRes = await fetch("/api/products/home", { signal: controller.signal });

      if (!homeRes.ok) {
        throw new Error("Failed to load home products");
      }

      const homeData = await homeRes.json().catch(() => ({}));

      const nextHomeProducts = Array.isArray(homeData.recommendedProducts) ? homeData.recommendedProducts : [];
      const nextPopularProducts = Array.isArray(homeData.popularProducts) ? homeData.popularProducts : [];
      const nextExclusiveProducts = Array.isArray(homeData.onlineExclusiveProducts) ? homeData.onlineExclusiveProducts : [];

      setHomeProducts(nextHomeProducts);
      setPopularProducts(nextPopularProducts);
      setExclusiveProducts(nextExclusiveProducts);
      setSearchResults([]);
      syncWithProducts([...nextHomeProducts, ...nextPopularProducts, ...nextExclusiveProducts]);
    } catch (error) {
      setProductError(PRODUCT_LOAD_ERROR_MESSAGE);
      if (process.env.NODE_ENV !== "production") {
        console.warn("상품 로딩 실패:", error);
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [debouncedSearch, isSearchMode, syncWithProducts, searchPage]);

  const fetchCategoryProducts = useCallback(async (categoryName: string, page: number) => {
    setCategoryLoading(true);
    try {
      const params = new URLSearchParams({ category: categoryName, page: String(page) });
      const res = await fetch(`/api/products?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to load category products");
      }

      const data = await res.json();
      const results = Array.isArray(data.products) ? data.products : [];
      const hasMore = data.hasMore ?? false;

      if (page === 1) {
        setCategoryProducts(results);
      } else {
        setCategoryProducts((prev) => [...prev, ...results]);
      }
      setCategoryHasMore(hasMore);
      syncWithProducts(results);
    } catch (error) {
      console.error("Category products loading failed:", error);
    } finally {
      setCategoryLoading(false);
    }
  }, [syncWithProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (hasCategorySelection && category !== CATEGORIES[0]) {
      fetchCategoryProducts(category, categoryPage);
    }
  }, [hasCategorySelection, category, categoryPage, fetchCategoryProducts]);

  useEffect(() => {
    if (categoryObserverRef.current) {
      categoryObserverRef.current.disconnect();
    }

    if (searchObserverRef.current) {
      searchObserverRef.current.disconnect();
    }

    if (!loadMoreRef.current) return;

    if (isSearchMode && searchHasMore && !searchLoading) {
      searchObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setSearchPage((prev) => prev + 1);
          }
        },
        { threshold: 0.1 }
      );
      searchObserverRef.current.observe(loadMoreRef.current);
    } else if (!isSearchMode && hasCategorySelection && categoryHasMore && !categoryLoading) {
      categoryObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setCategoryPage((prev) => prev + 1);
          }
        },
        { threshold: 0.1 }
      );
      categoryObserverRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (categoryObserverRef.current) {
        categoryObserverRef.current.disconnect();
      }
      if (searchObserverRef.current) {
        searchObserverRef.current.disconnect();
      }
    };
  }, [isSearchMode, searchHasMore, searchLoading, hasCategorySelection, categoryHasMore, categoryLoading]);

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
    if (nextCategory === "홈") {
      setCategory(CATEGORIES[0]);
      setHasCategorySelection(false);
      setSearch("");
      setDebouncedSearch("");
      setCategoryProducts([]);
      setCategoryPage(1);
      setCategoryHasMore(false);
    } else {
      setCategory(nextCategory);
      setHasCategorySelection(true);
      setSearch("");
      setDebouncedSearch("");
      setCategoryPage(1);
      setCategoryHasMore(false);
      setCategoryProducts([]);
    }
  }, []);

  const renderProductView = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="h-32 bg-gray-50 rounded-3xl animate-pulse" />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-36 bg-gray-50 rounded-xl animate-pulse sm:h-48 sm:rounded-3xl" />
            ))}
          </div>
        </div>
      );
    }

    if (isSearchMode) {
      if (searchResults.length === 0) {
        return <div className="py-20 text-center text-gray-400">검색 결과가 없습니다.</div>;
      }

      return (
        <>
          <div className="flex items-center gap-2 mt-8 mb-4">
            <span className="w-8 h-1 bg-gray-200 rounded-full" />
            <h2 className="text-lg font-bold text-gray-900">검색 결과</h2>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3.5">
            {searchResults.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd} />
            ))}
          </div>
          {searchHasMore && (
            <div className="flex justify-center mt-6" ref={loadMoreRef}>
              {searchLoading && (
                <div className="px-5 py-3 text-sm text-gray-500">로딩 중...</div>
              )}
            </div>
          )}
        </>
      );
    }

    if (isHomeView) {
      return (
        <>
          <ProductImageNotice />

          <RecommendedProducts products={homeProducts} onAdd={handleAdd} />

          <OnlineExclusiveProducts products={exclusiveProducts} onAdd={handleAdd} />

          <PopularProducts products={popularProducts} onAdd={handleAdd} />
        </>
      );
    }

    return (
      <>
        <div className="flex items-center gap-2 mt-8 mb-4">
          <span className="w-8 h-1 bg-gray-200 rounded-full" />
          <h2 className="text-lg font-bold text-gray-900">
            {category === CATEGORIES[0] ? "전체 상품" : category}
          </h2>
        </div>

        {categoryProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3.5">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={handleAdd} />
              ))}
            </div>
            {categoryHasMore && (
              <div className="flex justify-center mt-6" ref={loadMoreRef}>
                <button
                  type="button"
                  onClick={() => setCategoryPage((prev) => prev + 1)}
                  disabled={categoryLoading}
                  className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold min-h-[44px]"
                >
                  {categoryLoading ? "로딩 중..." : "더 보기"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-gray-400">표시할 상품이 없습니다.</div>
        )}
      </>
    );
  };

  return (
    <PriceProvider>
      <div className="min-h-screen bg-white">
        <Header cartCount={totalCount} showInstallButton />

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
              {minimumOrderEventActive
                ? `오픈 이벤트 ${formatPrice(minimumOrderAmount)} 이상`
                : `${formatPrice(minimumOrderAmount)} 이상`}
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
              type="search"
              name="product-search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
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

          <div className="sticky top-14 sm:top-16 z-30 -mx-3 sm:-mx-4 mb-4 sm:mb-6 overflow-x-auto bg-white/95 px-3 sm:px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex gap-2 pb-1">
              {visibleCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleCategoryChange(item)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition min-h-[44px] ${
                    item === "홈"
                      ? !hasCategorySelection
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
                      : hasCategorySelection && category === item
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

          {renderProductView()}
        </main>

        {toast.show && (
          <div className="fixed bottom-24 left-3 right-3 z-50 animate-slide-up sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
            <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-base font-bold text-center">
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
