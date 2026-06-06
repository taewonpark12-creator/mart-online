import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/upload";

cloudinary.config({
  url: process.env.CLOUDINARY_URL,
});

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

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "mart-online",
          resource_type: "image",
          format: ext.replace(".", ""),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    return NextResponse.json({ url: (result as any).secure_url });
  } catch (error) {
    console.error("[POST /api/admin/upload]", error);
    return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 500 });
  }
}
