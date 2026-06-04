"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

type Props = {
  // 부모 페이지에서 상품 전체 리스트를 받아옵니다.
  products: Product[];
  // 장바구니 담기 기능을 실행하는 함수입니다.
  onAdd: (product: Product) => void;
};

export function OnlineExclusiveProducts({ products, onAdd }: Props) {
  // [중요] 여기서 자동으로 필터링을 합니다.
  // 전체 상품 리스트 중에서 'isOnlineExclusive'가 true인 것만 골라냅니다.
  const exclusiveProducts = products.filter((p) => p.isOnlineExclusive);

  // 만약 온라인 특가 상품이 하나도 없다면, 화면에 아무것도 표시하지 않습니다.
  if (exclusiveProducts.length === 0) return null;

  return (
    <section className="mb-6 sm:mb-8">
      {/* 섹션 제목 영역 */}
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        {/* 별(⭐) 대신 태그(🏷️) 아이콘을 사용하고 색깔을 보라색으로 지정했습니다. */}
        <span className="text-xl sm:text-2xl text-purple-600" aria-hidden>
          🏷️
        </span>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">온라인 전용 특별가</h2>
      </div>

      {/* 상품들을 가로로 스크롤할 수 있는 영역 */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-3 sm:-mx-1 px-3 sm:px-1 scrollbar-hide snap-x snap-mandatory">
        {exclusiveProducts.map((product) => (
          <div key={product.id} className="w-[140px] sm:w-[168px] md:w-[200px] shrink-0 snap-start">
            {/* 기존에 사용하던 ProductCard 컴포넌트를 재사용합니다. */}
            <ProductCard product={product} onAdd={() => onAdd(product)} />
          </div>
        ))}
      </div>
    </section>
  );
}