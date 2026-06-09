"use client";

import React, { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";

type Props = {
  product: Product;
  onAdd: () => void;
};

function ProductCard({ product, onAdd }: Props) {
  const [realTimeData, setRealTimeData] = useState<{ normalPrice: number | null; eventPrice: number | null; discountRate: number | null } | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // 실시간 가격 조회
  useEffect(() => {
    if (!product.barcode) return;

    const trimmedBarcode = product.barcode.trim();
    let isMounted = true;

    const fetchRealTimePrice = async () => {
      setLoadingPrice(true);
      try {
        const response = await fetch(`http://localhost:3001/api/product?barcode=${trimmedBarcode}`);
        if (response.ok && isMounted) {
          const data = await response.json();
          console.log('실시간 가격 조회 결과:', data);
          console.log("EVENT TRACE", {
            rawBarcode: product.barcode,
            trimmedBarcode: trimmedBarcode,
            eventPrice: data.eventPrice,
            source: "API"
          });
          // eventPrice, normalPrice, discountRate를 모두 저장
          // null overwrite 방지: eventPrice가 null이면 기존 값 유지
          setRealTimeData(prev => ({
            ...prev,
            normalPrice: data.normalPrice ? Number(data.normalPrice) : null,
            eventPrice: data.eventPrice !== null && data.eventPrice !== undefined ? Number(data.eventPrice) : (prev?.eventPrice || null),
            discountRate: data.discountRate !== null && data.discountRate !== undefined ? Number(data.discountRate) : (prev?.discountRate || null)
          }));
        } else if (!isMounted) {
          console.log('컴포넌트 언마운트로 인한 요청 취소');
        } else {
          console.error('실시간 가격 조회 실패:', response.status);
        }
      } catch (error) {
        console.error('실시간 가격 조회 실패:', error);
      } finally {
        if (isMounted) {
          setLoadingPrice(false);
        }
      }
    };

    fetchRealTimePrice();

    return () => {
      isMounted = false;
    };
  }, [product.barcode]);

  // 표시할 가격 결정
  const normalPrice = realTimeData?.normalPrice || Number(product.price);
  const eventPrice = realTimeData?.eventPrice;
  const discountRate = realTimeData?.discountRate ?? null;
  const hasEvent = !loadingPrice && eventPrice !== null && eventPrice !== undefined && eventPrice > 0 && discountRate !== null && discountRate > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col h-full">
      <div className="relative bg-gray-50 h-32 sm:h-36 w-full">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 240px"
        />
        <button
          onClick={onAdd}
          className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition shadow-lg min-h-[40px] sm:min-h-[44px]"
        >
          + 담기
        </button>
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5 sm:gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] sm:text-xs text-green-600 font-medium bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full inline-block">
            {product.category}
          </span>
          <h3 className="font-semibold text-gray-900 mt-1 leading-snug text-sm sm:text-base line-clamp-2">{product.name}</h3>
          {product.description && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2 hidden sm:block">{product.description}</p>
          )}
        </div>
        <div className="mt-auto">
          {loadingPrice ? (
            <p className="font-bold text-green-700 text-base sm:text-lg">...</p>
          ) : hasEvent ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 line-through">{formatPrice(normalPrice)}</span>
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{discountRate}% 할인</span>
              </div>
              <p className="font-bold text-green-700 text-base sm:text-lg">{formatPrice(eventPrice)}</p>
            </div>
          ) : (
            <p className="font-bold text-green-700 text-base sm:text-lg">{formatPrice(normalPrice)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
