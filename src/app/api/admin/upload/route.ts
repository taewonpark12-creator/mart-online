import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_UPLOAD_DIR,
  PRODUCT_UPLOAD_URL_PREFIX,
} from "@/lib/upload";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "이미지 파일을 선택해 주세요." }, { status: 400 });
    }

    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      return NextResponse.json({ error: "이미지는 5MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const ext = ALLOWED_PRODUCT_IMAGE_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "JPG, PNG, WEBP, GIF 형식만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    await mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(PRODUCT_UPLOAD_DIR, filename), buffer);

    return NextResponse.json({ url: `${PRODUCT_UPLOAD_URL_PREFIX}/${filename}` });
  } catch (error) {
    console.error("[POST /api/admin/upload]", error);
    return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 500 });
  }
}
