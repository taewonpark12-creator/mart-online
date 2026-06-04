"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
}

export default function BackupPage() {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/admin/backup");
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      const data = await res.json();
      setBackups(data);
    } catch (error) {
      console.error("백업 목록 로딩 오류:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/backup?action=stats");
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("백업 통계 로딩 오류:", error);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchStats();
    setLoading(false);
  }, []);

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: "백업이 생성되었습니다." });
        fetchBackups();
        fetchStats();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "백업 생성에 실패했습니다." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "백업 생성 중 오류가 발생했습니다." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`정말로 ${filename}에서 복구하시겠습니까? 현재 데이터가 덮어씌워집니다.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", filename }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "데이터베이스가 복구되었습니다." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "복구에 실패했습니다." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "복구 중 오류가 발생했습니다." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`${filename} 백업을 삭제하시겠습니까?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", filename }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "백업이 삭제되었습니다." });
        fetchBackups();
        fetchStats();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "삭제에 실패했습니다." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "삭제 중 오류가 발생했습니다." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("오래된 백업(최근 10개 제외)을 삭제하시겠습니까?")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup" }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: `${data.deleted.length}개의 백업이 삭제되었습니다.` });
        fetchBackups();
        fetchStats();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "정리에 실패했습니다." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "정리 중 오류가 발생했습니다." });
    } finally {
      setActionLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("ko-KR");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">데이터 백업 관리</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600">전체 백업</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBackups}개</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600">전체 크기</p>
              <p className="text-2xl font-bold text-gray-900">{formatSize(stats.totalSize)}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600">최신 백업</p>
              <p className="text-sm font-bold text-gray-900">
                {stats.newestBackup ? formatDate(stats.newestBackup) : "-"}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-600">가장 오래된 백업</p>
              <p className="text-sm font-bold text-gray-900">
                {stats.oldestBackup ? formatDate(stats.oldestBackup) : "-"}
              </p>
            </div>
          </div>
        )}

        {/* 작업 버튼 */}
        <div className="bg-white rounded-lg border p-4 mb-6 flex flex-wrap gap-3">
          <button
            onClick={handleCreateBackup}
            disabled={actionLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? "처리 중..." : "📦 백업 생성"}
          </button>
          <button
            onClick={handleCleanup}
            disabled={actionLoading || !stats || stats.totalBackups <= 10}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? "처리 중..." : "🧹 오래된 백업 정리"}
          </button>
        </div>

        {/* 백업 목록 */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">백업 목록</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">백업이 없습니다.</div>
          ) : (
            <div className="divide-y">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{backup.filename}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(backup.createdAt)} · {formatSize(backup.size)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreBackup(backup.filename)}
                      disabled={actionLoading}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      복구
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.filename)}
                      disabled={actionLoading}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
