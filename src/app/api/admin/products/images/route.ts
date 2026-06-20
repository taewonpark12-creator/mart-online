import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeInput } from "@/lib/security";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "5CTXJMXh6ZfTnjgxw5og";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "Pmg86kSmBd";

cloudinary.config({
  url: process.env.CLOUDINARY_URL,
});

async function searchProductImages(query: string): Promise<string[]> {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
    query,
  )}&display=10&sort=sim`;
  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`네이버 이미지 검색 실패 (${response.status})`);
  }

  const data = await response.json();
  return (
    data?.items
      ?.map((item: { image?: unknown }) => item.image)
      .filter((image: unknown): image is string =>
        typeof image === "string" && /^https?:\/\//.test(image),
      )
      .slice(0, 5) ?? []
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = sanitizeInput(String(body?.id ?? "")).slice(0, 64);

    if (!id) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, imageUrl: true },
    });

    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    if (product.imageUrl?.trim()) {
      return NextResponse.json({ status: "skipped", reason: "existing_image" });
    }

    const candidates = await searchProductImages(product.name);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "이미지 검색 결과가 없습니다." }, { status: 422 });
    }

    let uploaded: { secure_url: string; public_id: string } | null = null;
    for (const candidate of candidates) {
      try {
        const result = await cloudinary.uploader.upload(candidate, {
          folder: "mart-online",
        });
        uploaded = { secure_url: result.secure_url, public_id: result.public_id };
        break;
      } catch (error) {
        console.warn(`[bulk product image] candidate upload failed: ${product.id}`, error);
      }
    }

    if (!uploaded) {
      return NextResponse.json({ error: "검색된 이미지를 업로드하지 못했습니다." }, { status: 502 });
    }

    const updated = await prisma.product.updateMany({
      where: {
        id: product.id,
        OR: [{ imageUrl: null }, { imageUrl: "" }],
      },
      data: { imageUrl: uploaded.secure_url },
    });

    if (updated.count === 0) {
      await cloudinary.uploader.destroy(uploaded.public_id).catch(() => undefined);
      return NextResponse.json({ status: "skipped", reason: "existing_image" });
    }

    await createAuditLog({
      action: "UPDATE",
      entity: "Product",
      entityId: product.id,
      changes: { imageUrl: uploaded.secure_url, source: "bulk_image_registration" },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ status: "success", imageUrl: uploaded.secure_url });
  } catch (error) {
    console.error("[POST /api/admin/products/images]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 자동 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
