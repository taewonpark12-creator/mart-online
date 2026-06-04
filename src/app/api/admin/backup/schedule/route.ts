import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createBackup, cleanupOldBackups } from "@/lib/backup";

export async function POST(req: NextRequest) {
  // 이 엔드포인트는 내부 스케줄링을 위한 것이므로 인증을 건너뛸 수 있음
  // 실제 운영 환경에서는 API 키 또는 헤더 기반 인증을 사용하는 것이 좋음

  try {
    const body = await req.json();
    const { secret } = body;

    // 간단한 시크릿 키 검증 (실제 운영에서는 더 강력한 인증 필요)
    if (secret !== process.env.BACKUP_SECRET) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }

    // 백업 생성
    const filename = await createBackup();

    // 오래된 백업 정리 (최근 10개 유지)
    const deleted = await cleanupOldBackups(10);

    return NextResponse.json({
      success: true,
      filename,
      deletedCount: deleted.length,
    });
  } catch (error) {
    console.error("Scheduled backup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "백업 실패" },
      { status: 500 }
    );
  }
}
