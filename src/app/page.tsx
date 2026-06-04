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
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  
  const { items, addItem, updateQuantity, removeItem, clearCart, syncWithProducts, totalAmount, totalCount } =
    useCart();

  const showRecommended = category === null && !debouncedSearch;
  const showAllProducts = category === "전체";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, message: "" }), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    
    // When category is null, only fetch recommended products
    // When category is "전체", fetch all products
    // When category is specific, fetch products in that category
    if (category && category !== "전체") {
      params.set("category", category);
    }
    if (debouncedSearch) params.set("q", debouncedSearch);
    
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
    setToast({ show: true, message: "장바구니에 추가됨" });
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
            <button onClick={() => setSearch("")} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg min-w-[32px] min-h-[32px] flex items-center justify-center">×
            </button>
          )}
        </div>

        {/* 카테고리 */}
        <div className="sticky top-[56px] sm:top-[64px] bg-white z-10 py-2 sm:py-3 -mx-3 sm:-mx-4 px-3 sm:px-4 mb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setCategory("전체")}
              className={`shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition min-h-[44px] ${
                category === "전체"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition min-h-[44px] ${
                  category === cat
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
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

            {showRecommended && (
              <OnlineExclusiveProducts products={products} onAdd={handleAdd} />
            )}

            {showAllProducts && products.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-8 mb-4">
                  <span className="w-8 h-1 bg-gray-200 rounded-full"></span>
                  <h2 className="text-lg font-bold text-gray-900">전체 상품</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={() => handleAdd(product)} />
                  ))}
                </div>
              </>
            )}

            {category && category !== "전체" && products.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                등록된 상품이 없습니다.
              </div>
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

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}