"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { OnlineExclusiveProducts } from "@/components/OnlineExclusiveProducts";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { PopularProducts } from "@/components/PopularProducts";
import { CartDrawer } from "@/components/CartDrawer";
import { OrderBar } from "@/components/OrderBar";
import { FlyerBanner } from "@/components/FlyerBanner";
import { FlyerModal } from "@/components/FlyerModal";
import { useCart } from "@/contexts/CartContext";
import type { Product } from "@/lib/types";
import { CATEGORIES, MIN_ORDER_AMOUNT, formatPrice } from "@/lib/types";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [exclusive, setExclusive] = useState<Product[]>([]);
  const [category, setCategory] = useState("추천상품");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [flyerModalOpen, setFlyerModalOpen] = useState(false);
  
  const { items, addItem, updateQuantity, removeItem, clearCart, syncWithProducts, totalAmount, totalCount } =
    useCart();

  const fetchCount = useRef(0);

  const showRecommended = category === "추천상품";
  const showAllProducts = category === "전체";
  const isSearchMode = !!debouncedSearch;

  // 프론트엔드 카테고리 필터링 (UI 표시용)
  const filteredProducts = products.filter((product) => {
    // 검색어가 있으면 카테고리 필터링 적용하지 않음 (전체 상품 기준 검색)
    if (debouncedSearch) return true;

    // 검색어가 없을 때만 카테고리 필터링 적용
    if (showAllProducts) return true;
    if (showRecommended) return true;
    if (category && category !== "추천상품" && category !== "전체") {
      return product.category === category;
    }
    return true;
  });

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
    fetchCount.current += 1;
    console.log(`[fetchProducts] 호출 횟수: ${fetchCount.current}`);
    setLoading(true);
    const params = new URLSearchParams();

    console.log("[fetchProducts] category:", category);
    console.log("[fetchProducts] debouncedSearch:", debouncedSearch);
    console.log("[fetchProducts] showRecommended:", showRecommended);

    // 검색은 항상 전체 상품 기준으로 수행
    if (debouncedSearch) {
      params.set("q", debouncedSearch);
      console.log("[fetchProducts] Setting search param:", debouncedSearch);
    } else {
      // 검색어가 없을 때만 카테고리 필터 적용
      if (category && category !== "추천상품" && category !== "전체") {
        params.set("category", category);
        console.log("[fetchProducts] Setting category param:", category);
      }
      if (showRecommended) {
        params.set("recommended", "true");
        console.log("[fetchProducts] Setting recommended param: true");
      }
    }

    const qs = params.toString();
    console.log("[fetchProducts] Query string:", qs);

    const recommendedParams = showRecommended ? "?recommended=true" : null;
    const popularParams = showRecommended ? "?popular=true" : null;
    const exclusiveParams = showRecommended ? "?onlineExclusive=true" : null;

    const [listRes, recommendedRes, popularRes, exclusiveRes] = await Promise.all([
      fetch(`/api/products${qs ? `?${qs}` : ""}`),
      recommendedParams ? fetch(`/api/products${recommendedParams}`) : Promise.resolve(null),
      popularParams ? fetch(`/api/products${popularParams}`) : Promise.resolve(null),
      exclusiveParams ? fetch(`/api/products${exclusiveParams}`) : Promise.resolve(null),
    ]);

    const listData = await listRes.json();
    const listArray = Array.isArray(listData) ? listData : [];
    console.log("[fetchProducts] listArray length:", listArray.length);
    let recData: Product[] = [];
    let popData: Product[] = [];
    let excData: Product[] = [];

    if (recommendedRes) {
      const raw = await recommendedRes.json();
      recData = Array.isArray(raw) ? raw : [];
      setRecommended(recData);
      console.log("[fetchProducts] recData length:", recData.length);
    } else {
      setRecommended([]);
    }

    if (popularRes) {
      const raw = await popularRes.json();
      popData = Array.isArray(raw) ? raw : [];
      setPopular(popData);
      console.log("[fetchProducts] popData length:", popData.length);
    } else {
      setPopular([]);
    }

    if (exclusiveRes) {
      const raw = await exclusiveRes.json();
      excData = Array.isArray(raw) ? raw : [];
      setExclusive(excData);
      console.log("[fetchProducts] excData length:", excData.length);
    } else {
      setExclusive([]);
    }

    setProducts(listArray);
    syncWithProducts(showRecommended ? [...recData, ...popData, ...excData, ...listArray] : listArray);

    setLoading(false);
  }, [category, debouncedSearch, showRecommended, syncWithProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleAdd(product: Product) {
    const result = addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      maxOrderQuantity: product.maxOrderQuantity,
    });
    if (result.success) {
      setToast({ show: true, message: "장바구니에 추가됨" });
    } else {
      setToast({ show: true, message: result.message || "추가 실패" });
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={totalCount} onCartClick={() => setCartOpen(true)} />

      {/* [옵션 1] 전체 배경을 흰색으로 변경, 너비를 좁혀서 깔끔하게 */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 sm:pb-28">

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

        {/* 세일 전단 배너 */}
        <div className="mb-4 sm:mb-6">
          <FlyerBanner onOpen={() => setFlyerModalOpen(true)} />
        </div>

        {/* 검색창 */}
        <div className="relative mb-4 sm:mb-6">
          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 검색"
            className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-10 sm:pr-12 bg-gray-50 border-none rounded-xl sm:rounded-2xl text-gray-800 text-sm sm:text-base focus:ring-2 focus:ring-emerald-500 transition-all"
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
              onClick={() => setCategory("추천상품")}
              className={`shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition min-h-[44px] ${
                category === "추천상품"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              추천상품
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
            {showRecommended && !isSearchMode && (
              <div className="mb-8">
                <RecommendedProducts products={recommended} onAdd={handleAdd} />
              </div>
            )}

            {showRecommended && !isSearchMode && (
              <OnlineExclusiveProducts products={exclusive} onAdd={handleAdd} />
            )}

            {showRecommended && !isSearchMode && popular.length > 0 && (
              <div className="mb-8">
                <PopularProducts products={popular} onAdd={handleAdd} />
              </div>
            )}

            {(isSearchMode || !showRecommended) && filteredProducts.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-8 mb-4">
                  <span className="w-8 h-1 bg-gray-200 rounded-full"></span>
                  <h2 className="text-lg font-bold text-gray-900">
                    {isSearchMode ? "검색 결과" : category === "전체" ? "전체 상품" : category}
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={() => handleAdd(product)} />
                  ))}
                </div>
              </>
            )}

            {(isSearchMode || !showRecommended) && filteredProducts.length === 0 && !loading && (
              <div className="py-20 text-center text-gray-400">
                {isSearchMode ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}
              </div>
            )}

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

      {/* 하단 고정 주문바 */}
      <OrderBar
        itemCount={totalCount}
        totalAmount={totalAmount}
        onOrderClick={() => setCartOpen(true)}
      />

      {/* 세일 전단 모달 */}
      <FlyerModal isOpen={flyerModalOpen} onClose={() => setFlyerModalOpen(false)} />
    </div>
  );
}