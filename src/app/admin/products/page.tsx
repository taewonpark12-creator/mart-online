"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { PRODUCT_CATEGORIES, formatPrice } from "@/lib/types";
import { PriceProvider, usePriceData } from "@/contexts/PriceContext";

type Product = {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  price: string | number;
  category: string;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  isRecommended: boolean;
  isOnlineExclusive: boolean;
  isPopular: boolean;
  isOutOfStock: boolean;
  maxOrderQuantity?: number | null;
};

type StatusFilter = "ALL" | "POPULAR" | "RECOMMENDED" | "LIMITED" | "OUT_OF_STOCK";
type ProductFlag = "isPopular" | "isRecommended" | "isOnlineExclusive" | "isOutOfStock";

type ProductForm = {
  name: string;
  description: string;
  barcode: string;
  price: string;
  category: string;
  imageUrl: string;
  stock: string;
  isPopular: boolean;
  isRecommended: boolean;
  isOnlineExclusive: boolean;
  isOutOfStock: boolean;
  maxOrderQuantity: string;
};

type BulkBarcodeResult = {
  created: number;
  updated: number;
  success: number;
  notFound: number;
  notFoundBarcodes: string[];
  total: number;
  error?: string;
};

type BulkImageResult = {
  total: number;
  target: number;
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "POPULAR", label: "인기상품" },
  { value: "RECOMMENDED", label: "추천상품" },
  { value: "LIMITED", label: "한정특가" },
  { value: "OUT_OF_STOCK", label: "품절" },
];

const STATUS_META: Record<ProductFlag, { label: string; activeClass: string; inactiveClass: string }> = {
  isPopular: {
    label: "인기상품",
    activeClass: "bg-red-100 text-red-700 border-red-200",
    inactiveClass: "bg-white text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-700",
  },
  isRecommended: {
    label: "추천상품",
    activeClass: "bg-amber-100 text-amber-800 border-amber-200",
    inactiveClass: "bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-800",
  },
  isOnlineExclusive: {
    label: "한정특가",
    activeClass: "bg-violet-100 text-violet-700 border-violet-200",
    inactiveClass: "bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-700",
  },
  isOutOfStock: {
    label: "품절",
    activeClass: "bg-gray-900 text-white border-gray-900",
    inactiveClass: "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800",
  },
};

const emptyForm = (): ProductForm => ({
  name: "",
  description: "",
  barcode: "",
  price: "",
  category: PRODUCT_CATEGORIES[0] ?? "미분류",
  imageUrl: "",
  stock: "0",
  isPopular: false,
  isRecommended: false,
  isOnlineExclusive: false,
  isOutOfStock: false,
  maxOrderQuantity: "",
});

function formFromProduct(product: Product): ProductForm {
  return {
    name: product.name,
    description: product.description ?? "",
    barcode: product.barcode ?? "",
    price: String(product.price),
    category: product.category,
    imageUrl: product.imageUrl ?? "",
    stock: String(product.stock ?? 0),
    isPopular: Boolean(product.isPopular),
    isRecommended: Boolean(product.isRecommended),
    isOnlineExclusive: Boolean(product.isOnlineExclusive),
    isOutOfStock: Boolean(product.isOutOfStock),
    maxOrderQuantity: product.maxOrderQuantity ? String(product.maxOrderQuantity) : "",
  };
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    isPopular: Boolean(product.isPopular),
    isRecommended: Boolean(product.isRecommended),
    isOnlineExclusive: Boolean(product.isOnlineExclusive),
    isOutOfStock: Boolean(product.isOutOfStock),
  };
}

function isSameForm(product: Product, form: ProductForm) {
  const original = formFromProduct(product);
  return Object.keys(original).every((key) => {
    const formKey = key as keyof ProductForm;
    return original[formKey] === form[formKey];
  });
}

function matchesStatus(product: Product, filter: StatusFilter) {
  if (filter === "POPULAR") return product.isPopular;
  if (filter === "RECOMMENDED") return product.isRecommended;
  if (filter === "LIMITED") return product.isOnlineExclusive;
  if (filter === "OUT_OF_STOCK") return product.isOutOfStock;
  return true;
}

function highlightText(text: string, query: string) {
  const safeQuery = query.trim();
  if (!safeQuery) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const start = lowerText.indexOf(lowerQuery);
  if (start < 0) return text;

  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-yellow-200 px-0.5 text-gray-950">{text.slice(start, start + safeQuery.length)}</mark>
      {text.slice(start + safeQuery.length)}
    </>
  );
}

function ProductTags({ product }: { product: Product }) {
  return (
    <div className="flex flex-wrap gap-1">
      {product.isPopular && <span className="rounded border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">인기상품</span>}
      {product.isRecommended && <span className="rounded border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">추천상품</span>}
      {product.isOnlineExclusive && <span className="rounded border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">한정특가</span>}
      {product.isOutOfStock && <span className="rounded border border-gray-300 bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">품절</span>}
    </div>
  );
}

const ProductListItem = memo(function ProductListItem({
  product,
  selected,
  checked,
  highlighted,
  searchQuery,
  onSelect,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  product: Product;
  selected: boolean;
  checked: boolean;
  highlighted: boolean;
  searchQuery: string;
  onSelect: () => void;
  onToggleSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { priceData } = usePriceData(product.barcode);
  const displayName = priceData?.name || product.name;
  const displayPrice = priceData?.eventPrice && priceData.eventPrice > 0 ? priceData.eventPrice : priceData?.normalPrice || Number(product.price) || 0;

  return (
    <div
      className={`grid grid-cols-[auto_56px_minmax(0,1fr)_96px_auto] items-center gap-3 border-b px-3 py-3 transition last:border-b-0 ${
        selected ? "bg-green-50" : highlighted ? "bg-emerald-50 animate-pulse" : "bg-white hover:bg-gray-50"
      } ${product.isOutOfStock ? "opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggleSelect(event.target.checked)}
        className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
        aria-label={`${displayName} 선택`}
      />
      <button type="button" onClick={onSelect} className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100 text-xs text-gray-400">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={displayName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">이미지 없음</span>
        )}
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <ProductTags product={product} />
        <p className="mt-1 truncate font-semibold text-gray-900" title={displayName}>
          {highlightText(displayName, searchQuery)}
        </p>
        <p className="truncate text-xs text-gray-500">{highlightText(product.barcode || "-", searchQuery)} · {product.category}</p>
      </button>
      <div className="text-right">
        <p className="text-sm font-black text-green-700">{formatPrice(displayPrice)}</p>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={onEdit} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200">
          수정
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
          삭제
        </button>
      </div>
    </div>
  );
});

function ProductFilterBar({
  statusFilter,
  categoryFilter,
  onStatusChange,
  onCategoryChange,
}: {
  statusFilter: StatusFilter;
  categoryFilter: string;
  onStatusChange: (filter: StatusFilter) => void;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onStatusChange(filter.value)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              statusFilter === filter.value ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategoryChange("")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            !categoryFilter ? "bg-green-600 text-white shadow-sm" : "border bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          전체
        </button>
        {PRODUCT_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              categoryFilter === category ? "bg-green-600 text-white shadow-sm" : "border bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductStatusController({
  product,
  busy,
  onToggle,
  onEdit,
}: {
  product: Product | null;
  busy: boolean;
  onToggle: (product: Product, flag: ProductFlag) => void;
  onEdit: (product: Product) => void;
}) {
  const { priceData } = usePriceData(product?.barcode ?? null);

  if (!product) {
    return (
      <aside className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-400">
        <p className="font-semibold">상품을 선택해주세요.</p>
        <p className="mt-2 text-sm">왼쪽 목록에서 상품을 선택하면 빠른 상태 제어가 열립니다.</p>
      </aside>
    );
  }

  const displayName = priceData?.name || product.name;
  const displayPrice = priceData?.eventPrice && priceData.eventPrice > 0 ? priceData.eventPrice : priceData?.normalPrice || Number(product.price) || 0;

  return (
    <aside className="sticky top-6 rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-5">
        <ProductTags product={product} />
        <h2 className="mt-2 text-lg font-black text-gray-900">{displayName}</h2>
        <p className="text-sm text-gray-500">{product.barcode || "바코드 없음"} · {product.category}</p>
        <p className="mt-3 text-2xl font-black text-green-700">{formatPrice(displayPrice)}</p>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">빠른 상태 변경</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_META) as ProductFlag[]).map((flag) => {
              const active = Boolean(product[flag]);
              const meta = STATUS_META[flag];
              return (
                <button
                  key={flag}
                  type="button"
                  disabled={busy}
                  onClick={() => onToggle(product, flag)}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold transition disabled:opacity-50 ${
                    active ? meta.activeClass : meta.inactiveClass
                  }`}
                >
                  {meta.label} {active ? "켜짐" : "꺼짐"}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">운영 정보</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">최대 주문</p>
              <p className="font-bold">{product.maxOrderQuantity || "제한 없음"}</p>
            </div>
          </div>
        </section>

        {product.description && (
          <section className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">설명</p>
            <p className="mt-2 leading-relaxed">{product.description}</p>
          </section>
        )}

        <button
          type="button"
          onClick={() => onEdit(product)}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-black"
        >
          세부 정보 편집
        </button>
      </div>
    </aside>
  );
}

function ProductBulkActionBar({
  selectedCount,
  bulkCategory,
  onBulkCategoryChange,
  onPatch,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  bulkCategory: string;
  onBulkCategoryChange: (category: string) => void;
  onPatch: (payload: Partial<Product>, message: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-green-200 bg-white p-4 shadow-lg">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-black text-gray-900">{selectedCount}개 상품 선택됨</p>
          <p className="text-xs text-gray-500">일괄 변경 전 선택 수량과 작업 내용을 확인하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={bulkCategory}
            onChange={(event) => onBulkCategoryChange(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">카테고리 선택</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => bulkCategory && onPatch({ category: bulkCategory }, "카테고리가 변경되었습니다.")}
            disabled={!bulkCategory}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            카테고리 변경
          </button>
          <button type="button" onClick={() => onPatch({ isPopular: true }, "인기상품으로 설정되었습니다.")} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">
            인기상품 설정
          </button>
          <button type="button" onClick={() => onPatch({ isRecommended: true }, "추천상품으로 설정되었습니다.")} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">
            추천상품 설정
          </button>
          <button type="button" onClick={() => onPatch({ isOnlineExclusive: true }, "한정특가로 설정되었습니다.")} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
            한정특가 설정
          </button>
          <button type="button" onClick={() => onPatch({ isOutOfStock: true }, "품절 처리되었습니다.")} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
            품절 처리
          </button>
          <button type="button" onClick={() => onPatch({ isPopular: false, isRecommended: false, isOnlineExclusive: false }, "상품 상태가 해제되었습니다.")} className="rounded-lg bg-gray-600 px-3 py-2 text-sm font-semibold text-white">
            태그 해제
          </button>
          <button type="button" onClick={onDelete} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100">
            삭제
          </button>
          <button type="button" onClick={onClear} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            선택 해제
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductImagePicker({
  productName,
  imageUrl,
  disabled,
  onSelect,
}: {
  productName: string;
  imageUrl: string;
  disabled: boolean;
  onSelect: (imageUrl: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(productName);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error ?? "이미지 업로드에 실패했습니다.");
      }
      await onSelect(uploadData.url);
    } finally {
      setUploading(false);
    }
  }

  async function uploadDirectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await uploadFile(file);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진 업로드 중 오류가 발생했습니다.");
    }
  }

  async function removeImage() {
    if (!confirm("이 상품의 이미지를 제거하시겠습니까?")) return;
    setUploading(true);
    try {
      await onSelect("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 제거에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function searchImages() {
    if (!query.trim()) return;
    setSearching(true);
    setCandidates([]);
    try {
      const res = await fetch(`/api/search-image?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "이미지 검색에 실패했습니다.");
      setCandidates(Array.isArray(data.images) ? data.images : []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 검색 중 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  }

  async function selectCandidate(candidateUrl: string) {
    setUploading(true);
    try {
      const downloadRes = await fetch("/api/download-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidateUrl }),
      });
      if (!downloadRes.ok) {
        const data = await downloadRes.json().catch(() => ({}));
        throw new Error(data.error ?? "이미지 다운로드에 실패했습니다.");
      }

      const blob = await downloadRes.blob();
      await uploadFile(new File([blob], "product-image", { type: blob.type }));
      setCandidates([]);
      setOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 변경 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">상품 이미지</p>
          <p className="text-xs text-gray-500">후보 미리보기는 외부 URL을 사용하며, 선택한 이미지 한 장만 업로드됩니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 ${disabled || uploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            사진 업로드
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void uploadDirectImage(event)}
              disabled={disabled || uploading}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            disabled={disabled || uploading}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {open ? "후보 닫기" : "이미지 후보 보기"}
          </button>
          <button
            type="button"
            onClick={() => void removeImage()}
            disabled={disabled || uploading || !imageUrl}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            이미지 제거
          </button>
        </div>
      </div>

      {imageUrl && (
        <img src={imageUrl} alt="현재 상품 이미지" className="mt-3 h-28 w-28 rounded-xl border bg-white object-contain" />
      )}

      {open && (
        <div className="mt-4 border-t pt-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchImages();
                }
              }}
              placeholder="네이버 이미지 검색어"
              disabled={searching || uploading}
              className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void searchImages()}
              disabled={searching || uploading || !query.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {searching ? "검색 중..." : "검색"}
            </button>
          </div>

          {uploading && <p className="mt-3 text-sm font-semibold text-blue-700">선택한 이미지 업로드 중...</p>}
          {!searching && candidates.length === 0 && (
            <p className="mt-3 text-xs text-gray-500">검색하면 최대 5개의 이미지 후보가 표시됩니다.</p>
          )}
          {candidates.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {candidates.slice(0, 5).map((candidate, index) => (
                <div
                  key={`${candidate}-${index}`}
                  className="overflow-hidden rounded-lg border bg-white p-1"
                >
                  <img
                    src={candidate}
                    alt={`이미지 후보 ${index + 1}`}
                    referrerPolicy="no-referrer"
                    className="h-20 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => void selectCandidate(candidate)}
                    disabled={uploading}
                    className="mt-1 w-full rounded-md bg-blue-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    이 이미지 사용
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ProductEditDrawer({
  open,
  mode,
  formData,
  dirty,
  saving,
  onChange,
  onImageSelect,
  onSubmit,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  formData: ProductForm;
  dirty: boolean;
  saving: boolean;
  onChange: (form: ProductForm) => void;
  onImageSelect: (imageUrl: string) => Promise<void>;
  onSubmit: (event?: React.FormEvent) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="편집 닫기" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <form onSubmit={onSubmit} className="min-h-full p-6">
          <div className="mb-6 flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                {mode === "edit" ? "상품 수정" : "상품 등록"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">
                {mode === "edit" ? "상품 정보 편집" : "새 상품 등록"}
              </h2>
              {dirty && <p className="mt-2 text-sm font-semibold text-amber-700">저장되지 않은 변경사항이 있습니다.</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              닫기
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-gray-700">상품명 *</span>
                <input
                  required
                  value={formData.name}
                  onChange={(event) => onChange({ ...formData, name: event.target.value })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-gray-700">바코드</span>
                <input
                  value={formData.barcode}
                  onChange={(event) => onChange({ ...formData, barcode: event.target.value })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-gray-700">가격 *</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(event) => onChange({ ...formData, price: event.target.value })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-gray-700">카테고리 *</span>
                <select
                  required
                  value={formData.category}
                  onChange={(event) => onChange({ ...formData, category: event.target.value })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                >
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-gray-700">최대 주문 수량</span>
                <input
                  type="number"
                  min="0"
                  value={formData.maxOrderQuantity}
                  onChange={(event) => onChange({ ...formData, maxOrderQuantity: event.target.value })}
                  className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-gray-700">이미지 URL</span>
              <input
                value={formData.imageUrl}
                onChange={(event) => onChange({ ...formData, imageUrl: event.target.value })}
                className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
              />
            </label>

            <ProductImagePicker
              productName={formData.name}
              imageUrl={formData.imageUrl}
              disabled={saving}
              onSelect={onImageSelect}
            />

            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-gray-700">설명</span>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(event) => onChange({ ...formData, description: event.target.value })}
                className="w-full rounded-lg border px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
              />
            </label>

            <section className="rounded-2xl border bg-gray-50 p-4">
              <p className="mb-3 text-sm font-bold text-gray-900">상태 설정</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(STATUS_META) as ProductFlag[]).map((flag) => (
                  <label key={flag} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(formData[flag])}
                      onChange={(event) => onChange({ ...formData, [flag]: event.target.checked })}
                      className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                    />
                    {STATUS_META[flag].label}
                  </label>
                ))}
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 mt-8 flex gap-2 border-t bg-white py-4">
            <button
              type="submit"
              disabled={mode === "edit" ? !dirty || saving : saving}
              className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "저장 중..." : mode === "edit" ? "변경사항 저장" : "상품 등록"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-300">
              취소
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<ProductForm>(() => emptyForm());
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [flashProductId, setFlashProductId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [bulkBarcodeText, setBulkBarcodeText] = useState("");
  const [bulkBarcodeLoading, setBulkBarcodeLoading] = useState(false);
  const [bulkBarcodeResult, setBulkBarcodeResult] = useState<BulkBarcodeResult | null>(null);
  const [bulkImageLoading, setBulkImageLoading] = useState(false);
  const [bulkImageResult, setBulkImageResult] = useState<BulkImageResult | null>(null);

  const activeProduct = useMemo(
    () => products.find((product) => product.id === activeProductId) ?? products[0] ?? null,
    [products, activeProductId],
  );

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [products, editingProductId],
  );

  const displayedProducts = useMemo(() => {
    return products.filter((product) => matchesStatus(product, statusFilter));
  }, [products, statusFilter]);

  const isDirty = useMemo(() => {
    if (showCreateForm) {
      return !Object.keys(emptyForm()).every((key) => {
        const formKey = key as keyof ProductForm;
        return emptyForm()[formKey] === formData[formKey];
      });
    }
    if (!editingProduct) return false;
    return !isSameForm(editingProduct, formData);
  }, [editingProduct, formData, showCreateForm]);

  const allDisplayedSelected =
    displayedProducts.length > 0 && displayedProducts.every((product) => selectedIds.has(product.id));

  const selectedSummary = useMemo(() => {
    const selected = products.filter((product) => selectedIds.has(product.id));
    return {
      popular: selected.filter((product) => product.isPopular).length,
      recommended: selected.filter((product) => product.isRecommended).length,
      limited: selected.filter((product) => product.isOnlineExclusive).length,
      outOfStock: selected.filter((product) => product.isOutOfStock).length,
    };
  }, [products, selectedIds]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        activeOnly: "false",
        includeOutOfStock: "true",
        ...(searchQuery ? { q: searchQuery } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      });
      const res = await fetch(`/api/products?${params.toString()}`);

      if (res.status === 401) {
        console.log("[ADMIN REDIRECT]", {
          source: "/admin/products",
          target: "/admin",
          reason: "products_api_unauthorized",
          pathname,
          isAuthenticated: false,
          status: res.status,
          timestamp: Date.now(),
        });
        console.log("[REDIRECT EXECUTE]", {
          from: pathname,
          to: "/admin",
          timestamp: Date.now(),
        });
        router.replace("/admin");
        return;
      }

      if (!res.ok) {
        throw new Error("상품 목록을 불러오지 못했습니다.");
      }

      const data = await res.json();
      const normalizedProducts = Array.isArray(data) ? data.map(normalizeProduct) : [];
      setProducts(normalizedProducts);
      setActiveProductId((current) => current ?? normalizedProducts[0]?.id ?? null);
    } catch (error) {
      console.error("[admin/products] load failed", error);
      setToast("상품 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, pathname, router, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!flashProductId) return;
    const timer = setTimeout(() => setFlashProductId(null), 1800);
    return () => clearTimeout(timer);
  }, [flashProductId]);

  const closeEditor = useCallback(() => {
    if (isDirty && !confirm("저장되지 않은 변경사항이 있습니다. 닫으시겠습니까?")) return;
    setShowCreateForm(false);
    setEditingProductId(null);
    setFormData(emptyForm());
  }, [isDirty]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showCreateForm && !editingProductId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void saveProduct();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function updateProductInState(product: Product) {
    const normalized = normalizeProduct(product);
    setProducts((current) =>
      current.map((item) => (item.id === normalized.id ? normalized : item)),
    );
    setFlashProductId(normalized.id);
  }

  async function saveProduct(event?: React.FormEvent) {
    event?.preventDefault();
    if (editingProduct && !isDirty) return;

    const targetId = editingProduct?.id ?? "new";
    setSavingProductId(targetId);
    try {
      const res = await fetch(editingProduct ? `/api/products/${editingProduct.id}` : "/api/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          stock: Number(formData.stock),
          barcode: formData.barcode.trim() || null,
          imageUrl: formData.imageUrl.trim() || null,
          description: formData.description.trim() || null,
          maxOrderQuantity: formData.maxOrderQuantity ? Number(formData.maxOrderQuantity) : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "상품 저장에 실패했습니다.");
      }

      const saved = normalizeProduct(data);
      if (editingProduct) {
        updateProductInState(saved);
        setToast("상품 수정이 저장되었습니다.");
      } else {
        setProducts((current) => [saved, ...current]);
        setActiveProductId(saved.id);
        setFlashProductId(saved.id);
        setToast("상품이 등록되었습니다.");
      }

      setShowCreateForm(false);
      setEditingProductId(null);
      setFormData(emptyForm());
    } catch (error) {
      console.error("[admin/products] save failed", error);
      alert(error instanceof Error ? error.message : "상품 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingProductId(null);
    }
  }

  async function saveSelectedImage(imageUrl: string) {
    if (!editingProduct) {
      setFormData((current) => ({ ...current, imageUrl }));
      return;
    }

    setSavingProductId(editingProduct.id);
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "상품 이미지 저장에 실패했습니다.");

      updateProductInState(normalizeProduct(data));
      setFormData((current) => ({ ...current, imageUrl: data.imageUrl ?? imageUrl }));
      setToast("선택한 상품 이미지가 저장되었습니다.");
    } finally {
      setSavingProductId(null);
    }
  }

  async function toggleFlag(product: Product, flag: ProductFlag) {
    const previousProduct = product;
    const nextValue = !product[flag];
    setBusyProductId(product.id);
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, [flag]: nextValue } : item)),
    );

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "상태 변경 실패");
      updateProductInState(data);
      setToast(`${STATUS_META[flag].label} 상태가 변경되었습니다.`);
    } catch (error) {
      console.error("[admin/products] status toggle failed", error);
      setProducts((current) => current.map((item) => (item.id === previousProduct.id ? previousProduct : item)));
      alert("상품 상태 변경에 실패했습니다.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function deleteProducts(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}개 상품을 삭제하시겠습니까?`)) return;

    const res = await fetch("/api/admin/products/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!res.ok) {
      alert("상품 삭제에 실패했습니다.");
      return;
    }

    setProducts((current) => current.filter((product) => !ids.includes(product.id)));
    setSelectedIds(new Set());
    setActiveProductId((current) => (current && ids.includes(current) ? null : current));
    setToast("상품을 삭제했습니다.");
  }

  async function bulkPatch(payload: Partial<Product>, message: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const previousById = new Map(products.map((product) => [product.id, product]));
    setProducts((current) =>
      current.map((product) => (selectedIds.has(product.id) ? { ...product, ...payload } : product)),
    );

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `일괄 변경 실패: ${id}`);
        return normalizeProduct(data);
      }),
    );

    const savedProducts = results
      .filter((result): result is PromiseFulfilledResult<Product> => result.status === "fulfilled")
      .map((result) => result.value);
    const failedIds = ids.filter((_, index) => results[index].status === "rejected");

    setProducts((current) =>
      current.map((product) => {
        const saved = savedProducts.find((item) => item.id === product.id);
        if (saved) return saved;
        if (failedIds.includes(product.id)) return previousById.get(product.id) ?? product;
        return product;
      }),
    );

    if (savedProducts.length > 0) {
      setFlashProductId(savedProducts[0].id);
    }

    if (failedIds.length > 0) {
      alert(`${failedIds.length}개 상품 변경에 실패했습니다. 실패 항목은 원래 상태로 되돌렸습니다.`);
    } else {
      setSelectedIds(new Set());
      setToast(message);
    }
  }

  async function registerBulkBarcodes() {
    const barcodes = Array.from(
      new Set(
        bulkBarcodeText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );

    if (barcodes.length === 0) {
      setBulkBarcodeResult({
        created: 0,
        updated: 0,
        success: 0,
        notFound: 0,
        notFoundBarcodes: [],
        total: 0,
        error: "등록할 바코드를 입력해주세요.",
      });
      return;
    }

    setBulkBarcodeLoading(true);
    setBulkBarcodeResult(null);

    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodes }),
      });
      const data = (await res.json().catch(() => ({}))) as BulkBarcodeResult;

      if (!res.ok) {
        setBulkBarcodeResult({
          created: 0,
          updated: 0,
          success: 0,
          notFound: 0,
          notFoundBarcodes: [],
          total: barcodes.length,
          error: data.error ?? "바코드 대량 등록에 실패했습니다.",
        });
        return;
      }

      setBulkBarcodeResult(data);
      setBulkBarcodeText("");
      setToast("바코드 대량 등록이 완료되었습니다.");
      await fetchProducts();
    } catch (error) {
      console.error("[admin/products] bulk barcode registration failed", error);
      setBulkBarcodeResult({
        created: 0,
        updated: 0,
        success: 0,
        notFound: 0,
        notFoundBarcodes: [],
        total: barcodes.length,
        error: "바코드 대량 등록 중 오류가 발생했습니다.",
      });
    } finally {
      setBulkBarcodeLoading(false);
    }
  }

  async function registerMissingImages() {
    setBulkImageLoading(true);
    setBulkImageResult(null);

    try {
      const productsRes = await fetch("/api/products?activeOnly=false&includeOutOfStock=true");
      const allProductsData = await productsRes.json().catch(() => ({}));
      if (!productsRes.ok || !Array.isArray(allProductsData)) {
        throw new Error(allProductsData.error ?? "전체 상품 목록을 불러오지 못했습니다.");
      }

      const allProducts = allProductsData as Product[];
      const targets = allProducts.filter((product) => !product.imageUrl?.trim());
      const result: BulkImageResult = {
        total: allProducts.length,
        target: targets.length,
        success: 0,
        skipped: allProducts.length - targets.length,
        failed: 0,
        errors: [],
      };
      setBulkImageResult({ ...result });

      if (targets.length === 0) return;
      if (!confirm(`이미지가 없는 상품 ${targets.length}개에 이미지를 일괄 등록하시겠습니까?\n\n기존 이미지가 있는 ${result.skipped}개 상품은 건너뜁니다.`)) {
        return;
      }

      let nextIndex = 0;
      async function worker() {
        while (nextIndex < targets.length) {
          const product = targets[nextIndex++];
          try {
            const res = await fetch("/api/admin/products/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: product.id }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              throw new Error(data.error ?? "이미지 등록 실패");
            }
            if (data.status === "success") result.success += 1;
            else result.skipped += 1;
          } catch (error) {
            result.failed += 1;
            result.errors.push(
              `${product.name}: ${error instanceof Error ? error.message : "이미지 등록 실패"}`,
            );
          }
          setBulkImageResult({ ...result, errors: [...result.errors] });
        }
      }

      await Promise.all(Array.from({ length: Math.min(3, targets.length) }, () => worker()));
      setToast("이미지 일괄등록이 완료되었습니다.");
      await fetchProducts();
    } catch (error) {
      console.error("[admin/products] bulk image registration failed", error);
      setBulkImageResult({
        total: 0,
        target: 0,
        success: 0,
        skipped: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : "이미지 일괄등록 중 오류가 발생했습니다."],
      });
    } finally {
      setBulkImageLoading(false);
    }
  }

  function guardDirtyChange(next: () => void) {
    if (isDirty && !confirm("저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?")) return;
    next();
  }

  function startEdit(product: Product) {
    guardDirtyChange(() => {
      setShowCreateForm(false);
      setActiveProductId(product.id);
      setEditingProductId(product.id);
      setFormData(formFromProduct(product));
    });
  }

  function startCreate() {
    guardDirtyChange(() => {
      setActiveProductId(null);
      setEditingProductId(null);
      setFormData(emptyForm());
      setShowCreateForm(true);
    });
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <PriceProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">상품 운영 콘솔</h1>
              <p className="mt-1 text-sm text-gray-500">
                상품 상태, 노출 태그, 품절 여부를 빠르게 제어하는 실시간 운영 화면입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="상품명, 바코드, 설명 검색"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full rounded-xl border px-4 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500 sm:w-80"
              />
              <button
                type="button"
                onClick={() => void registerMissingImages()}
                disabled={bulkImageLoading}
                className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkImageLoading ? "이미지 등록 중..." : "이미지 일괄등록"}
              </button>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700"
              >
                + 상품 추가
              </button>
            </div>
          </div>

          {bulkImageResult && (
            <section className="mb-4 rounded-2xl border border-purple-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black text-gray-900">이미지 일괄등록 로그</h2>
                {bulkImageLoading && <span className="text-sm font-semibold text-purple-700">처리 중...</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <p className="rounded-lg bg-gray-50 p-3">전체 상품 <strong>{bulkImageResult.total}개</strong></p>
                <p className="rounded-lg bg-gray-50 p-3">처리 대상 <strong>{bulkImageResult.target}개</strong></p>
                <p className="rounded-lg bg-green-50 p-3 text-green-800">성공 <strong>{bulkImageResult.success}개</strong></p>
                <p className="rounded-lg bg-blue-50 p-3 text-blue-800">기존 이미지 건너뜀 <strong>{bulkImageResult.skipped}개</strong></p>
                <p className="rounded-lg bg-red-50 p-3 text-red-800">실패 <strong>{bulkImageResult.failed}개</strong></p>
              </div>
              {bulkImageResult.errors.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">
                  {bulkImageResult.errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}
                </div>
              )}
            </section>
          )}

          <ProductFilterBar
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
            onStatusChange={setStatusFilter}
            onCategoryChange={(category) => {
              setCategoryFilter(category);
              setSearchInput("");
              setSearchQuery("");
            }}
          />

          <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-bold text-gray-800">
                바코드 텍스트 대량 등록
              </label>
              <textarea
                value={bulkBarcodeText}
                onChange={(event) => setBulkBarcodeText(event.target.value)}
                placeholder={"8801234567890\n8801234567891\n8801234567892"}
                rows={5}
                className="w-full resize-y rounded-xl border px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                한 줄에 하나의 바코드만 입력하세요. 상품명과 가격은 POS prices.json 기준으로만 등록됩니다.
              </p>
            </div>
            <div className="w-full lg:w-64">
              <button
                type="button"
                onClick={registerBulkBarcodes}
                disabled={bulkBarcodeLoading}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
              >
                {bulkBarcodeLoading ? "등록 중..." : "등록"}
              </button>
              {bulkBarcodeResult && (
                <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-xs text-gray-700">
                  {bulkBarcodeResult.error ? (
                    <p className="font-semibold text-red-600">{bulkBarcodeResult.error}</p>
                  ) : (
                    <>
                      <p>전체: {bulkBarcodeResult.total}개</p>
                      <p>성공: {bulkBarcodeResult.success}개</p>
                      <p>신규 등록: {bulkBarcodeResult.created}개</p>
                      <p>업데이트: {bulkBarcodeResult.updated}개</p>
                      <p>실패: {bulkBarcodeResult.notFound}개</p>
                      {bulkBarcodeResult.notFoundBarcodes.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold text-red-600">POS에 없는 바코드</p>
                          <p className="mt-1 break-words font-mono">
                            {bulkBarcodeResult.notFoundBarcodes.join(", ")}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mt-4">
          <ProductBulkActionBar
            selectedCount={selectedIds.size}
            bulkCategory={bulkCategory}
            onBulkCategoryChange={setBulkCategory}
            onPatch={bulkPatch}
            onDelete={() => deleteProducts(Array.from(selectedIds))}
            onClear={() => setSelectedIds(new Set())}
          />
          {selectedIds.size > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              선택 항목: 인기상품 {selectedSummary.popular} · 추천상품 {selectedSummary.recommended} · 한정특가 {selectedSummary.limited} · 품절 {selectedSummary.outOfStock}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b bg-gray-50 px-3 py-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={allDisplayedSelected}
                  onChange={(event) => {
                    if (event.target.checked) setSelectedIds(new Set(displayedProducts.map((product) => product.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                />
                현재 목록 전체 선택
              </label>
              <span className="text-xs font-semibold text-gray-500">{displayedProducts.length}개 표시</span>
            </div>

            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="py-20 text-center text-gray-400">표시할 상품이 없습니다.</div>
            ) : (
              displayedProducts.map((product) => (
                <ProductListItem
                  key={product.id}
                  product={product}
                  selected={activeProduct?.id === product.id}
                  checked={selectedIds.has(product.id)}
                  highlighted={flashProductId === product.id}
                  searchQuery={searchQuery}
                  onSelect={() => setActiveProductId(product.id)}
                  onToggleSelect={(checked) => toggleSelection(product.id, checked)}
                  onEdit={() => startEdit(product)}
                  onDelete={() => deleteProducts([product.id])}
                />
              ))
            )}
          </section>

          <ProductStatusController
            product={activeProduct}
            busy={Boolean(busyProductId && activeProduct?.id === busyProductId)}
            onToggle={toggleFlag}
            onEdit={startEdit}
          />
        </div>
      </div>

      <ProductEditDrawer
        open={showCreateForm || Boolean(editingProduct)}
        mode={editingProduct ? "edit" : "create"}
        formData={formData}
        dirty={isDirty}
        saving={Boolean(savingProductId)}
        onChange={setFormData}
        onImageSelect={saveSelectedImage}
        onSubmit={saveProduct}
        onClose={closeEditor}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  </PriceProvider>
);
}
