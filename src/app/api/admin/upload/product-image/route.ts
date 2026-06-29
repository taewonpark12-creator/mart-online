import { randomUUID } from "crypto";
import { mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  ALLOWED_PRODUCT_IMAGE_EXTENSIONS,
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_UPLOAD_DIR,
  PRODUCT_UPLOAD_URL_PREFIX,
} from "@/lib/upload";

export const runtime = "nodejs";

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function createProductImageFilename() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const uniqueId = randomUUID().slice(0, 12);

  return `product-${date}-${uniqueId}.webp`;
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 이미지 파일을 선택해주세요." }, { status: 400 });
    }

    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      return NextResponse.json({ error: "상품 이미지는 10MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_PRODUCT_IMAGE_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "jpg, jpeg, png, webp 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    if (!ALLOWED_PRODUCT_IMAGE_TYPES[file.type]) {
      return NextResponse.json({ error: "허용되지 않는 이미지 형식입니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = createProductImageFilename();
    const outputPath = path.join(PRODUCT_UPLOAD_DIR, filename);

    await mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });

    try {
      await sharp(buffer, { failOn: "warning" })
        .rotate()
        .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);
    } catch {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    return NextResponse.json({ url: `${PRODUCT_UPLOAD_URL_PREFIX}/${filename}` });
  } catch (error) {
    console.error("[POST /api/admin/upload/product-image]", error);
    return NextResponse.json({ error: "상품 이미지 업로드에 실패했습니다." }, { status: 500 });
  }
}
