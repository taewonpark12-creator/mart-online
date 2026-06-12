"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { PRODUCT_CATEGORIES, formatPrice } from "@/lib/types";
import * as XLSX from "xlsx";

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode: "",
    price: "",
    category: "미분류",
    imageUrl: "",
    stock: "",
    isRecommended: false,
    isOnlineExclusive: false,
    isPopular: false,
    isOutOfStock: false,
    maxOrderQuantity: "",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [autoUploadingImages, setAutoUploadingImages] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const requestIdRef = useRef(0);

  const fetchProducts = useCallback(async (query: string, category: string, outOfStock: boolean) => {
    const requestId = ++requestIdRef.current;
    try {
      const fetchWithRetry = async (retries = 3): Promise<void> => {
        for (let i = 0; i < retries; i++) {
          try {
            const params = new URLSearchParams({
              activeOnly: "false",
              ...(query ? { q: query } : {}),
              ...(category ? { category: category } : {}),
              ...(outOfStock ? { outOfStock: "true" } : {}),
            });
            const res = await fetch(`/api/products?${params}`);
            if (!res.ok) {
              if (res.status === 401) {
                router.replace("/admin");
                return;
              }
              const errorData = await res.json().catch(() => ({}));
              console.error("API Error:", errorData);
              throw new Error(errorData.error || "데이터를 불러오지 못했습니다.");
            }
            const data = await res.json();
            if (requestId === requestIdRef.current) {
              setProducts(data);
            }
            return;
          } catch (error) {
            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
              continue;
            }
            throw error;
          }
        }
      };

      await fetchWithRetry();
    } catch (error) {
      console.error("로딩 에러:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
  }, [searchQuery, categoryFilter, outOfStockOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          stock: Number(formData.stock),
          maxOrderQuantity: formData.maxOrderQuantity ? Number(formData.maxOrderQuantity) : null,
        }),
      });

      if (res.ok) {
        fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
        setShowForm(false);
        setEditingProduct(null);
        setFormData({
          name: "",
          description: "",
          barcode: "",
          price: "",
          category: "미분류",
          imageUrl: "",
          stock: "",
          isRecommended: false,
          isOnlineExclusive: false,
          isPopular: false,
          isOutOfStock: false,
          maxOrderQuantity: "",
        });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "저장에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      price: typeof product.price === 'string' ? product.price : String(product.price),
      category: product.category as any,
      imageUrl: product.imageUrl || "",
      stock: String(product.stock),
      isRecommended: product.isRecommended,
      isOnlineExclusive: product.isOnlineExclusive,
      isPopular: product.isPopular || false,
      isOutOfStock: product.isOutOfStock || false,
      maxOrderQuantity: product.maxOrderQuantity ? String(product.maxOrderQuantity) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} 상품을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/products/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      if (res.ok) {
        fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/products/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
        setSelectedIds(new Set());
        setShowBulkActions(false);
        alert("선택한 상품이 삭제되었습니다.");
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleToggleActive = async (id: string, isOutOfStock: boolean) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOutOfStock: !isOutOfStock }),
      });

      if (res.ok) {
        fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkCategoryChange = async () => {
    if (!bulkCategory || selectedIds.size === 0) return;

    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        const updateWithRetry = async (retries = 3): Promise<any> => {
          for (let i = 0; i < retries; i++) {
            try {
              const res = await fetch(`/api/products/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: bulkCategory }),
              });

              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`상품 ID ${id} 업데이트 실패: ${errorData.error || '알 수 없는 오류'}`);
              }

              return res.json();
            } catch (error) {
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                continue;
              }
              throw error;
            }
          }
        };

        return updateWithRetry();
      });

      await Promise.all(promises);
      fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      setSelectedIds(new Set());
      setBulkCategory("");
      setShowBulkActions(false);
      alert("카테고리가 일괄 변경되었습니다.");
    } catch (error) {
      console.error(error);
      alert(`일괄 변경 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleBulkOnlineExclusiveChange = async (value: boolean) => {
    if (selectedIds.size === 0) return;

    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnlineExclusive: value }),
        })
      );

      await Promise.all(promises);
      fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      setSelectedIds(new Set());
      setShowBulkActions(false);
      alert("온라인 전용이 일괄 변경되었습니다.");
    } catch (error) {
      console.error(error);
      alert("일괄 변경 중 오류가 발생했습니다.");
    }
  };

  const handleBulkRecommendedChange = async (value: boolean) => {
    if (selectedIds.size === 0) return;

    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRecommended: value }),
        })
      );

      await Promise.all(promises);
      fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      setSelectedIds(new Set());
      setShowBulkActions(false);
      alert("추천 상품이 일괄 변경되었습니다.");
    } catch (error) {
      console.error(error);
      alert("일괄 변경 중 오류가 발생했습니다.");
    }
  };

  const handleBulkPopularChange = async (value: boolean) => {
    if (selectedIds.size === 0) return;

    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPopular: value }),
        })
      );

      await Promise.all(promises);
      fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
      setSelectedIds(new Set());
      setShowBulkActions(false);
      alert("인기 상품이 일괄 변경되었습니다.");
    } catch (error) {
      console.error(error);
      alert("일괄 변경 중 오류가 발생했습니다.");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      console.log("엑셀 파싱 결과:", jsonData);

      // 헤더 행 감지 및 건너뛰기
      const startIndex = jsonData.length > 0 && typeof jsonData[0][1] === 'string' ? 1 : 0;

      const productsToCreate = jsonData.slice(startIndex)
        .filter((row) => row && row.length >= 2)
        .map((row) => {
          const salePrice = row[3];
          const basePrice = row[2];
          // 행사가가 0보다 큰 경우에만 행사가 사용, 0이거나 없으면 기본가 사용
          const hasSalePrice = salePrice !== undefined && salePrice !== null && salePrice !== '' && Number(salePrice) > 0;
          const finalPrice = hasSalePrice ? Number(salePrice) : Number(basePrice || 0);
          console.log(`행: ${row[1]}, 전체데이터: [${row.join(', ')}], 기본가(${row[2]}): ${basePrice}, 행사가(${row[3]}): ${salePrice}, 행사가있음: ${hasSalePrice}, 최종가: ${finalPrice}`);
          return {
            barcode: row[0] ? String(row[0]) : null,
            name: row[1] ? String(row[1]).trim() : "",
            price: finalPrice,
            category: PRODUCT_CATEGORIES[0],
            description: null,
            imageUrl: null,
            stock: 0,
            isRecommended: false,
            isOnlineExclusive: false,
            isPopular: false,
          };
        })
        .filter((p) => p.name);

      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productsToCreate),
      });

      if (res.ok) {
        const data = await res.json();
        fetchProducts(searchQuery, categoryFilter, outOfStockOnly);
        setShowExcelUpload(false);
        alert(`상품 일괄 처리 완료:\n- 생성: ${data.created}개\n- 업데이트: ${data.updated}개\n- 스킵: ${data.skipped}개\n- 총: ${data.total}개`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "일괄 등록에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("엑셀 파일 처리 중 오류가 발생했습니다.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, imageUrl: data.url });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "이미지 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSearch = async () => {
    if (!imageSearchQuery.trim()) return;

    setSearchingImages(true);
    try {
      const res = await fetch(`/api/search-image?query=${encodeURIComponent(imageSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setImageSearchResults(data.images || []);
      } else {
        alert("이미지 검색에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("이미지 검색 중 오류가 발생했습니다.");
    } finally {
      setSearchingImages(false);
    }
  };

  const handleSelectSearchImage = async (imageUrl: string) => {
    setUploadingImage(true);
    try {
      const downloadRes = await fetch("/api/download-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!downloadRes.ok) {
        const errorData = await downloadRes.json().catch(() => ({}));
        alert(errorData.error ?? "이미지 다운로드에 실패했습니다.");
        return;
      }

      const blob = await downloadRes.blob();
      const file = new File([blob], "image.jpg", { type: blob.type });

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        setFormData({ ...formData, imageUrl: data.url });
        setImageSearchResults([]);
        setImageSearchQuery("");
      } else {
        const data = await uploadRes.json().catch(() => ({}));
        alert(data.error ?? "이미지 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("이미지 다운로드 및 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAutoImageUpload = async () => {
    const productsWithoutImages = products.filter(p => !p.imageUrl);
    if (productsWithoutImages.length === 0) {
      alert("이미지가 없는 상품이 없습니다.");
      return;
    }

    const CONCURRENCY = 3;
    const estimatedTime = Math.ceil(productsWithoutImages.length / CONCURRENCY * 2 / 60);
    if (!confirm(`${productsWithoutImages.length}개 상품의 이미지를 자동으로 업로드하시겠습니까?\n\n예상 소요 시간: 약 ${estimatedTime}분\n\n동시에 ${CONCURRENCY}개씩 처리하여 속도를 최적화합니다.`)) return;

    setAutoUploadingImages(true);
    let successCount = 0;
    let failCount = 0;
    let processedCount = 0;
    const errors: string[] = [];

    const processProduct = async (product: any, retryCount = 0): Promise<void> => {
      const maxRetries = 2;

      try {
        console.log(`[${processedCount + 1}/${productsWithoutImages.length}] 상품 ${product.name} 이미지 검색 시작...`);
        const searchRes = await fetch(`/api/search-image?query=${encodeURIComponent(product.name)}`);

        if (!searchRes.ok) {
          const errorData = await searchRes.json().catch(() => ({}));
          console.error(`상품 ${product.name} 검색 실패:`, errorData);

          if (errorData.error && (errorData.error.includes("속도 제한") || searchRes.status === 429)) {
            if (retryCount < maxRetries) {
              const waitTime = Math.pow(2, retryCount) * 5000;
              console.log(`속도 제한 도달, ${waitTime / 1000}초 대기 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              return processProduct(product, retryCount + 1);
            }
          }

          errors.push(`${product.name}: 검색 실패 - ${errorData.error || '알 수 없는 오류'}`);
          failCount++;
          processedCount++;
          return;
        }

        const searchData = await searchRes.json();
        console.log(`상품 ${product.name} 검색 결과:`, searchData.images?.length || 0);
        if (!searchData.images || searchData.images.length === 0) {
          errors.push(`${product.name}: 검색 결과 없음`);
          failCount++;
          processedCount++;
          return;
        }

        const imageUrl = searchData.images[0];
        console.log(`상품 ${product.name} 이미지 다운로드: ${imageUrl}`);

        const downloadRes = await fetch("/api/download-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl }),
        });

        if (!downloadRes.ok) {
          const errorData = await downloadRes.json().catch(() => ({}));
          console.error(`상품 ${product.name} 이미지 다운로드 실패:`, errorData);

          if (retryCount < maxRetries) {
            console.log(`이미지 다운로드 재시도 (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return processProduct(product, retryCount + 1);
          }

          errors.push(`${product.name}: 이미지 다운로드 실패 - ${errorData.error || '알 수 없는 오류'}`);
          failCount++;
          processedCount++;
          return;
        }

        const blob = await downloadRes.blob();
        const file = new File([blob], "image.jpg", { type: blob.type });

        console.log(`상품 ${product.name} 이미지 업로드 시작...`);
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);

        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          console.log(`상품 ${product.name} 업로드 완료: ${uploadData.url}`);
          const updateRes = await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: uploadData.url }),
          });

          if (updateRes.ok) {
            console.log(`상품 ${product.name} 업데이트 완료`);
            successCount++;
            processedCount++;
          } else {
            const errorData = await updateRes.json().catch(() => ({}));
            console.error(`상품 ${product.name} 업데이트 실패:`, errorData);

            if (retryCount < maxRetries) {
              console.log(`상품 업데이트 재시도 (${retryCount + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              return processProduct(product, retryCount + 1);
            }

            errors.push(`${product.name}: 업데이트 실패 - ${errorData.error || '알 수 없는 오류'}`);
            failCount++;
            processedCount++;
          }
        } else {
          const errorData = await uploadRes.json().catch(() => ({}));
          console.error(`상품 ${product.name} 업로드 실패:`, errorData);

          if (retryCount < maxRetries) {
            console.log(`이미지 업로드 재시도 (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return processProduct(product, retryCount + 1);
          }

          errors.push(`${product.name}: 업로드 실패 - ${errorData.error || '알 수 없는 오류'}`);
          failCount++;
          processedCount++;
        }
      } catch (error) {
        console.error(`상품 ${product.name} 이미지 업로드 실패:`, error);

        if (retryCount < maxRetries) {
          console.log(`일반 오류 재시도 (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return processProduct(product, retryCount + 1);
        }

        errors.push(`${product.name}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        failCount++;
        processedCount++;
      }
    };

    const processQueue = async (queue: any[]): Promise<void> => {
      const results = await Promise.allSettled(
        queue.map(product => processProduct(product))
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`상품 ${queue[index].name} 처리 실패:`, result.reason);
        }
      });
    };

    for (let i = 0; i < productsWithoutImages.length; i += CONCURRENCY) {
      const batch = productsWithoutImages.slice(i, i + CONCURRENCY);
      await processQueue(batch);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setAutoUploadingImages(false);
    fetchProducts(searchQuery, categoryFilter, outOfStockOnly);

    if (errors.length > 0) {
      console.error("이미지 업로드 오류들:", errors);
      alert(`이미지 업로드 완료: 성공 ${successCount}개, 실패 ${failCount}개\n\n오류 내용:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...외 ${errors.length - 5}개` : ''}`);
    } else {
      alert(`이미지 업로드 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="상품명, 바코드, 설명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 w-64"
            />
            <button
              onClick={handleAutoImageUpload}
              disabled={autoUploadingImages}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {autoUploadingImages ? "이미지 업로드 중..." : "🖼️ 자동 이미지 업로드"}
            </button>
            <button
              onClick={() => setShowExcelUpload(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              📊 엑셀 일괄 등록
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                setFormData({
                  name: "",
                  description: "",
                  barcode: "",
                  price: "",
                  category: "미분류",
                  imageUrl: "",
                  stock: "",
                  isRecommended: false,
                  isOnlineExclusive: false,
                  isPopular: false,
                  isOutOfStock: false,
                  maxOrderQuantity: "",
                });
                setShowForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              + 상품 추가
            </button>
          </div>
        </div>

        {/* 카테고리 필터 버튼 */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => {
  setCategoryFilter("");
  setSearchInput("");
  setSearchQuery("");
}}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!categoryFilter ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
          >
            전체
          </button>
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
  setCategoryFilter(cat);
  setSearchInput("");
  setSearchQuery("");
}}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${categoryFilter === cat ? "bg-green-600 text-white shadow-md" : "bg-white border text-gray-600 hover:bg-gray-100"}`}
            >
              {cat}
            </button>
          ))}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition cursor-pointer border hover:bg-gray-100">
            <input
              type="checkbox"
              checked={outOfStockOnly}
              onChange={(e) => {
  setOutOfStockOnly(e.target.checked);
  setSearchInput("");
  setSearchQuery("");
}}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            품절만
          </label>
        </div>

        {showExcelUpload && (
          <div className="bg-white rounded-2xl border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">엑셀 일괄 등록</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">엑셀 파일 형식:</p>
                <p>1열: 바코드, 2열: 상품명, 3열: 기본가격, 4열: 행사가(선택)</p>
                <p className="mt-1 text-xs">4열에 행사가 입력 시 해당 가격으로 등록, 비어있으면 3열 기본가격 사용</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <button
                onClick={() => setShowExcelUpload(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="bg-white rounded-2xl border p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size}개 상품 선택됨
              </span>
              <div className="flex gap-2">
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">카테고리 선택</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkCategoryChange}
                  disabled={!bulkCategory}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  카테고리 변경
                </button>
                <button
                  onClick={() => handleBulkOnlineExclusiveChange(true)}
                  className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  온라인전용 설정
                </button>
                <button
                  onClick={() => handleBulkOnlineExclusiveChange(false)}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm"
                >
                  온라인전용 해제
                </button>
                <button
                  onClick={() => handleBulkRecommendedChange(true)}
                  className="bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 text-sm"
                >
                  추천 설정
                </button>
                <button
                  onClick={() => handleBulkRecommendedChange(false)}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm"
                >
                  추천 해제
                </button>
                <button
                  onClick={() => handleBulkPopularChange(true)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  인기상품 설정
                </button>
                <button
                  onClick={() => handleBulkPopularChange(false)}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm"
                >
                  인기상품 해제
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-2xl border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingProduct ? "상품 수정" : "새 상품 등록"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품명 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    바코드
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리 *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    가격 *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    재고
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    최대 주문 수량
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="비워두면 제한 없음"
                    value={formData.maxOrderQuantity}
                    onChange={(e) => setFormData({ ...formData, maxOrderQuantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 또는 비워두면 제한 없음</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품 이미지
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="네이버 이미지 검색..."
                        value={imageSearchQuery}
                        onChange={(e) => setImageSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleImageSearch()}
                        disabled={searchingImages || uploadingImage}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <button
                        type="button"
                        onClick={handleImageSearch}
                        disabled={searchingImages || uploadingImage || !imageSearchQuery.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {searchingImages ? "검색 중..." : "검색"}
                      </button>
                    </div>
                    {uploadingImage && (
                      <p className="text-sm text-gray-500">이미지 업로드 중...</p>
                    )}
                    {imageSearchResults.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {imageSearchResults.map((imageUrl, index) => (
                          <div
                            key={index}
                            className="relative cursor-pointer group bg-gray-100 rounded-lg overflow-hidden h-20"
                            onClick={() => handleSelectSearchImage(imageUrl)}
                          >
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <img
                                src={imageUrl}
                                alt={`검색 결과 ${index + 1}`}
                                className="max-w-full max-h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center">
                              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition">선택</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {formData.imageUrl && (
                      <div className="relative w-32 h-32">
                        <img
                          src={formData.imageUrl}
                          alt="상품 이미지 미리보기"
                          className="w-full h-full object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: "" })}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isRecommended}
                    onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">추천 상품</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isOnlineExclusive}
                    onChange={(e) => setFormData({ ...formData, isOnlineExclusive: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">온라인 전용</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">인기상품</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isOutOfStock}
                    onChange={(e) => setFormData({ ...formData, isOutOfStock: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">품절</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  {editingProduct ? "수정" : "등록"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                  }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
            등록된 상품이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white rounded-lg border p-3">
              <input
                type="checkbox"
                checked={selectedIds.size === products.length && products.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-600">전체 선택</span>
            </div>
            <div className="grid gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border p-1 shadow-sm hover:shadow-md transition ${
                  product.isOutOfStock ? "opacity-60" : ""
                }`}
              >
                <div className="grid grid-cols-[auto_80px_100px_48px_1fr_100px_80px_auto] items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <div className="flex gap-1">
                    {product.isRecommended && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                        추천
                      </span>
                    )}
                    {product.isOnlineExclusive && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        온라인
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap truncate" title={product.barcode || ""}>
                    {product.barcode || "-"}
                  </span>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      없음
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 truncate" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-sm font-bold text-green-700 whitespace-nowrap">
                    {formatPrice(Number(product.price))}
                  </p>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {product.category}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200 font-medium"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleToggleActive(product.id, product.isOutOfStock)}
                      className={`text-sm px-2 py-1 rounded-lg font-medium ${
                        product.isOutOfStock
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {product.isOutOfStock ? "품절해제" : "품절"}
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
                      className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200 font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}