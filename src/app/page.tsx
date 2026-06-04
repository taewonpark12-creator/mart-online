"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { OnlineExclusiveProducts } from "@/components/OnlineExclusiveProducts";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/lib/types";
import { CATEGORIES, MIN_ORDER_AMOUNT, formatPrice } from "@/lib/types";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [category, setCategory] = useState("전체");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  
  const { items, addItem, updateQuantity, removeItem, clearCart, syncWithProducts, totalAmount, totalCount } =
    useCart();

  const showRecommended = category === "전체" && !debouncedSearch;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "전체") params.set("category", category);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (showRecommended) params.set("excludeRecommended", "true");
    const qs = params.toString();

    const recommendedParams = showRecommended ? "?recommended=true" : null;

    const [listRes, recommendedRes] = await Promise.all([
      fetch(`/api/products${qs ? `?${qs}` : ""}`),
      recommendedParams ? fetch(`/api/products${recommendedParams}`) : Promise.resolve(null),
    ]);

    const listData = await listRes.json();
    const listArray = Array.isArray(listData) ? listData : [];
    let recData: Product[] = [];

    if (recommendedRes) {
      const raw = await recommendedRes.json();
      recData = Array.isArray(raw) ? raw : [];
      setRecommended(recData);
    } else {
      setRecommended([]);
    }

    setProducts(listArray);
    syncWithProducts(showRecommended ? [...recData, ...listArray] : listArray);

    setLoading(false);
  }, [category, debouncedSearch, showRecommended, syncWithProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleAdd(product: Product) {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      maxOrderQuantity: product.maxOrderQuantity,
    });
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={totalCount} onCartClick={() => setCartOpen(true)} />

      {/* [옵션 1] 전체 배경을 흰색으로 변경, 너비를 좁혀서 깔끔하게 */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

        {/* 헤더 정보를 카드로 분리 */}
        <div className="bg-emerald-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 border border-emerald-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">한사랑마트</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">신선한 식재료를 빠르게 배달해 드립니다.</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <a
              href="https://open.kakao.com/o/sdPlnVxi"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 hover:bg-yellow-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold text-yellow-900 shadow-sm border border-yellow-500 transition"
            >
              💬 카카오톡 1:1 문의
            </a>
            <div className="bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold text-emerald-700 shadow-sm border border-emerald-100">
              🚚 숭의동, 용현동 배달
            </div>
            <div className="bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold text-emerald-700 shadow-sm border border-emerald-100">
              💰 {formatPrice(MIN_ORDER_AMOUNT)} 이상
            </div>
          </div>
        </div>

        {/* 검색창 */}
        <div className="relative mb-4 sm:mb-6">
          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 검색"
            className="w-full h-10 sm:h-12 pl-10 sm:pl-12 bg-gray-50 border-none rounded-xl sm:rounded-2xl text-gray-800 text-sm sm:text-base focus:ring-2 focus:ring-emerald-500 transition-all"
            aria-label="상품 검색"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×
            </button>
          )}
        </div>

        {/* 카테고리 */}
        <div className="flex gap-2 overflow-x-auto pb-3 sm:pb-4 scrollbar-hide mb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition ${
                category === cat
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
             {/* 로딩 스타일도 깔끔하게 */}
             <div className="h-32 bg-gray-50 rounded-3xl animate-pulse" />
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               {Array.from({ length: 6 }).map((_, i) => (
                 <div key={i} className="h-48 bg-gray-50 rounded-3xl animate-pulse" />
               ))}
             </div>
          </div>
        ) : (
          <>
            {showRecommended && (
              <div className="mb-8">
                <RecommendedProducts products={recommended} onAdd={handleAdd} />
              </div>
            )}

            <OnlineExclusiveProducts products={products} onAdd={handleAdd} />

            {products.length === 0 && (!showRecommended || recommended.length === 0) ? (
              <div className="py-20 text-center text-gray-400">
                등록된 상품이 없습니다.
              </div>
            ) : products.length > 0 ? (
              <>
                {showRecommended && recommended.length > 0 && (
                  <div className="flex items-center gap-2 mt-8 mb-4">
                    <span className="w-8 h-1 bg-gray-200 rounded-full"></span>
                    <h2 className="text-lg font-bold text-gray-900">전체 상품</h2>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={() => handleAdd(product)} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      {cartOpen && (
        <CartDrawer
          items={items}
          totalAmount={totalAmount}
          onClose={() => setCartOpen(false)}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onOrderComplete={() => {
            clearCart();
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}