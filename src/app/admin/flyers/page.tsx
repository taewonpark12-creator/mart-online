"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function FlyerManagementPage() {
  const router = useRouter();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url");
  const [file, setFile] = useState<File | null>(null);

  const fetchFlyers = async () => {
    try {
      const res = await fetch("/api/admin/flyers");
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        console.error("전단지 로딩 오류:", res.status);
        return;
      }
      const data = await res.json();
      setFlyers(data);
    } catch (error) {
      console.error("전단지 로딩 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlyers();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadMethod === "url") {
      if (!imageUrl) return;

      setUploading(true);
      try {
        const res = await fetch("/api/admin/flyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "업로드 실패");
          return;
        }

        setImageUrl("");
        fetchFlyers();
      } catch (error) {
        console.error("전단지 업로드 오류:", error);
        alert("업로드 실패");
      } finally {
        setUploading(false);
      }
    } else {
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          alert(data.error || "파일 업로드 실패");
          return;
        }

        const uploadData = await uploadRes.json();
        const uploadedUrl = uploadData.url;

        const res = await fetch("/api/admin/flyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: uploadedUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "전단지 등록 실패");
          return;
        }

        setFile(null);
        fetchFlyers();
      } catch (error) {
        console.error("파일 업로드 오류:", error);
        alert("업로드 실패");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/flyers/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("삭제 실패");
        return;
      }

      fetchFlyers();
    } catch (error) {
      console.error("전단지 삭제 오류:", error);
      alert("삭제 실패");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/flyers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!res.ok) {
        alert("상태 변경 실패");
        return;
      }

      fetchFlyers();
    } catch (error) {
      console.error("상태 변경 오류:", error);
      alert("상태 변경 실패");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newFlyers = [...flyers];
    const temp = newFlyers[index];
    newFlyers[index] = newFlyers[index - 1];
    newFlyers[index - 1] = temp;

    await updateOrders(newFlyers);
  };

  const handleMoveDown = async (index: number) => {
    if (index === flyers.length - 1) return;

    const newFlyers = [...flyers];
    const temp = newFlyers[index];
    newFlyers[index] = newFlyers[index + 1];
    newFlyers[index + 1] = temp;

    await updateOrders(newFlyers);
  };

  const updateOrders = async (newFlyers: Flyer[]) => {
    try {
      await Promise.all(
        newFlyers.map((flyer, index) =>
          fetch(`/api/admin/flyers/${flyer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: index }),
          })
        )
      );
      fetchFlyers();
    } catch (error) {
      console.error("순서 변경 오류:", error);
      alert("순서 변경 실패");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">전단지 관리</h1>

        {/* 전단지 업로드 */}
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">전단지 이미지 업로드</h2>
          
          {/* 업로드 방식 선택 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setUploadMethod("url")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                uploadMethod === "url"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              URL 입력
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod("file")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                uploadMethod === "file"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              파일 업로드
            </button>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            {uploadMethod === "url" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이미지 URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/flyer.jpg"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cloudinary 또는 외부 이미지 호스팅 서비스의 URL을 입력하세요.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이미지 파일
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WEBP, GIF 형식 (최대 5MB)
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={uploading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition"
            >
              {uploading ? "업로드 중..." : "업로드"}
            </button>
          </form>
        </div>

        {/* 전단지 목록 */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">등록된 전단지</h2>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : flyers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록된 전단지가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {flyers.map((flyer, index) => (
                <div
                  key={flyer.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    !flyer.isActive ? "bg-gray-50 opacity-60" : "bg-white"
                  }`}
                >
                  <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={flyer.imageUrl}
                      alt={`전단지 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      전단지 {index + 1}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {flyer.imageUrl}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          flyer.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {flyer.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === flyers.length - 1}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => handleToggleActive(flyer.id, flyer.isActive)}
                      className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      {flyer.isActive ? "숨김" : "표시"}
                    </button>
                    <button
                      onClick={() => handleDelete(flyer.id)}
                      className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="mt-6 bg-blue-50 rounded-2xl border border-blue-200 p-4">
          <h3 className="font-semibold text-blue-900 mb-2">사용 방법</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• URL 입력 또는 파일 업로드 방식 중 하나를 선택하세요.</li>
            <li>• 파일 업로드는 JPG, PNG, WEBP, GIF 형식 (최대 5MB)을 지원합니다.</li>
            <li>• ↑↓ 버튼으로 전단지 순서를 변경할 수 있습니다.</li>
            <li>• 표시/숨김 버튼으로 전단지 노출 여부를 제어할 수 있습니다.</li>
            <li>• 삭제 버튼으로 전단지를 삭제할 수 있습니다.</li>
            <li>• 고객 페이지에서 전단지 배너를 클릭하면 등록된 전단지를 볼 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
