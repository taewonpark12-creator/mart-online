"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

type Flyer = {
  id: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FlyerAnnouncement = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  showOnlineOrder?: boolean;
  showPhoneOrder?: boolean;
  createdAt: string;
  updatedAt: string;
};

const MAX_FLYER_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_FLYER_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getFlyerUploadErrorMessage(status: number, data: unknown) {
  const response = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const message = String(response.message || response.error || "전단 이미지 업로드에 실패했습니다.");
  const code = typeof response.code === "string" ? response.code : "";
  const requestId = typeof response.requestId === "string" ? response.requestId : "";

  return [
    message,
    code ? `오류 코드: ${code}` : "",
    requestId ? `요청 ID: ${requestId}` : "",
    `HTTP 상태: ${status}`,
  ].filter(Boolean).join("\n");
}

export default function FlyerManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [announcementId, setAnnouncementId] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementIsActive, setAnnouncementIsActive] = useState(false);
  const [announcementShowOnlineOrder, setAnnouncementShowOnlineOrder] = useState(true);
  const [announcementShowPhoneOrder, setAnnouncementShowPhoneOrder] = useState(true);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementDeleting, setAnnouncementDeleting] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementError, setAnnouncementError] = useState("");

  const fetchFlyers = async () => {
    try {
      const res = await fetch("/api/admin/flyers");
      if (!res.ok) {
        if (res.status === 401) {
          console.log("[ADMIN REDIRECT]", {
            source: "/admin/flyers",
            target: "/admin",
            reason: "flyers_api_unauthorized",
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

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch("/api/admin/flyer-announcement", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin");
          return;
        }
        setAnnouncementError("홍보문구를 불러오지 못했습니다.");
        return;
      }

      const data = await res.json();
      const announcement = data?.announcement as FlyerAnnouncement | null;

      setAnnouncementId(announcement?.id ?? "");
      setAnnouncementTitle(announcement?.title ?? "");
      setAnnouncementContent(announcement?.content ?? "");
      setAnnouncementIsActive(Boolean(announcement?.isActive));
      setAnnouncementShowOnlineOrder(announcement?.showOnlineOrder ?? true);
      setAnnouncementShowPhoneOrder(announcement?.showPhoneOrder ?? true);
    } catch (error) {
      console.error("홍보문구 로딩 오류:", error);
      setAnnouncementError("홍보문구를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    fetchFlyers();
    fetchAnnouncement();
  }, []);

  const handleAnnouncementSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setAnnouncementSaving(true);
    setAnnouncementMessage("");
    setAnnouncementError("");

    try {
      const res = await fetch("/api/admin/flyer-announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: announcementId || undefined,
          title: announcementTitle,
          content: announcementContent,
          isActive: announcementIsActive,
          showOnlineOrder: announcementShowOnlineOrder,
          showPhoneOrder: announcementShowPhoneOrder,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAnnouncementError(data?.error || data?.message || "홍보문구 저장에 실패했습니다.");
        return;
      }

      const announcement = data?.announcement as FlyerAnnouncement | null;
      setAnnouncementId(announcement?.id ?? "");
      setAnnouncementTitle(announcement?.title ?? "");
      setAnnouncementContent(announcement?.content ?? "");
      setAnnouncementIsActive(Boolean(announcement?.isActive));
      setAnnouncementShowOnlineOrder(announcement?.showOnlineOrder ?? true);
      setAnnouncementShowPhoneOrder(announcement?.showPhoneOrder ?? true);
      setAnnouncementMessage("홍보문구를 저장했습니다.");
    } catch (error) {
      console.error("홍보문구 저장 오류:", error);
      setAnnouncementError("홍보문구 저장 중 네트워크 오류가 발생했습니다.");
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleAnnouncementHide = async () => {
    if (!announcementId || announcementDeleting) return;

    setAnnouncementDeleting(true);
    setAnnouncementMessage("");
    setAnnouncementError("");

    try {
      const res = await fetch(`/api/admin/flyer-announcement?id=${encodeURIComponent(announcementId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAnnouncementError(data?.error || data?.message || "홍보문구 숨김 처리에 실패했습니다.");
        return;
      }

      setAnnouncementIsActive(false);
      setAnnouncementMessage("고객 페이지에서 홍보문구를 숨겼습니다.");
    } catch (error) {
      console.error("홍보문구 숨김 오류:", error);
      setAnnouncementError("홍보문구 숨김 처리 중 네트워크 오류가 발생했습니다.");
    } finally {
      setAnnouncementDeleting(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl) return;

    setUploading(true);
    setUploadError("");
    try {
      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || data.message || "업로드 실패");
        return;
      }

      setImageUrl("");
      fetchFlyers();
    } catch (error) {
      console.error("전단지 업로드 오류:", error);
      setUploadError("전단지 업로드 중 네트워크 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_FLYER_UPLOAD_BYTES) {
      setUploadError("전단 이미지는 20MB 이하만 업로드할 수 있습니다.");
      return;
    }

    if (!ALLOWED_FLYER_UPLOAD_TYPES.has(file.type)) {
      setUploadError("JPG, PNG, WebP 전단 이미지만 업로드할 수 있습니다.");
      return;
    }

    setFileUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok || !uploadData?.url) {
        setUploadError(getFlyerUploadErrorMessage(uploadRes.status, uploadData));
        return;
      }

      const createRes = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.url }),
      });
      const createData = await createRes.json().catch(() => ({}));

      if (!createRes.ok) {
        setUploadError(createData?.error || createData?.message || "전단지 등록에 실패했습니다.");
        return;
      }

      fetchFlyers();
    } catch (error) {
      console.error("전단지 파일 업로드 오류:", error);
      setUploadError("전단 이미지 업로드 중 네트워크 오류가 발생했습니다.");
    } finally {
      setFileUploading(false);
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
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-800">고객 페이지 홍보문구</h2>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                announcementIsActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {announcementIsActive ? "표시 중" : "숨김"}
            </span>
          </div>

          {announcementLoading ? (
            <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
          ) : (
            <form onSubmit={handleAnnouncementSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  maxLength={80}
                  placeholder="예: 이번 주 온라인 주문 특가"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용
                </label>
                <textarea
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  maxLength={1000}
                  placeholder={"전단지 위에 표시할 안내문을 입력하세요.\n줄바꿈은 고객 페이지에서도 그대로 표시됩니다."}
                  rows={5}
                  className="w-full resize-y border rounded-xl px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-green-400"
                  required
                />
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={announcementIsActive}
                  onChange={(e) => setAnnouncementIsActive(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                고객에게 표시
              </label>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="mb-3 text-sm font-bold text-gray-800">주문 안내</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={announcementShowOnlineOrder}
                      onChange={(e) => setAnnouncementShowOnlineOrder(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    온라인 주문하기
                  </label>
                  <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={announcementShowPhoneOrder}
                      onChange={(e) => setAnnouncementShowPhoneOrder(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    전화주문 안내
                  </label>
                </div>
              </div>

              {announcementMessage && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                  {announcementMessage}
                </div>
              )}
              {announcementError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {announcementError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={announcementSaving || announcementDeleting}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition"
                >
                  {announcementSaving ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={handleAnnouncementHide}
                  disabled={!announcementId || announcementDeleting || announcementSaving}
                  className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold py-3 px-6 rounded-xl transition"
                >
                  {announcementDeleting ? "숨김 처리 중..." : "숨김 처리"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">전단지 이미지 업로드</h2>
          
          {/* 업로드 방식 선택 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              className="flex-1 py-2 px-4 rounded-lg bg-green-600 text-sm font-medium text-white"
            >
              URL 입력
            </button>
            <label
              className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
                fileUploading
                  ? "bg-gray-100 text-gray-400"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {fileUploading ? "파일 업로드 중..." : "파일 업로드"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={fileUploading}
                onChange={(event) => {
                  void handleFileUpload(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
                className="sr-only"
              />
            </label>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
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
                외부 이미지 URL을 입력하거나, 위 파일 업로드로 20MB 이하 전단 이미지를 등록하세요.
              </p>
            </div>
            {uploadError && (
              <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                {uploadError}
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
                      referrerPolicy="no-referrer"
                      onError={() => {
                        console.error("[/admin/flyers] Failed to load flyer image:", flyer.imageUrl);
                      }}
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
            <li>• 이미지 URL을 입력해 전단지를 등록하세요.</li>
            <li>• 파일 업로드는 JPG, PNG, WebP를 지원하며 서버에서 WebP로 압축됩니다.</li>
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
