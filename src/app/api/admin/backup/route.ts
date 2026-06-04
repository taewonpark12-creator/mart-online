import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  cleanupOldBackups,
} from "@/lib/backup";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "stats") {
      const stats = await getBackupStats();
      return NextResponse.json(stats);
    }

    const backups = await listBackups();
    return NextResponse.json(backups);
  } catch (error) {
    console.error("Backup list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "백업 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, filename } = body;

    if (action === "create") {
      const filename = await createBackup();
      return NextResponse.json({ success: true, filename });
    }

    if (action === "restore" && filename) {
      await restoreBackup(filename);
      return NextResponse.json({ success: true, message: "데이터베이스가 복구되었습니다." });
    }

    if (action === "delete" && filename) {
      await deleteBackup(filename);
      return NextResponse.json({ success: true, message: "백업이 삭제되었습니다." });
    }

    if (action === "cleanup") {
      const deleted = await cleanupOldBackups();
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ error: "유효하지 않은 작업입니다." }, { status: 400 });
  } catch (error) {
    console.error("Backup action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "백업 작업에 실패했습니다." },
      { status: 500 }
    );
  }
}
