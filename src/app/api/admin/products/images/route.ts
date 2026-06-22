import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeInput } from "@/lib/security";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "5CTXJMXh6ZfTnjgxw5og";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "Pmg86kSmBd";

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
        typeof image === "string" &&
        /^https?:\/\//.test(image) &&
        !image.toLowerCase().includes("res.cloudinary.com"),
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

    const currentImageUrl = product.imageUrl?.trim() ?? "";
    const replacingCloudinary = currentImageUrl.toLowerCase().includes("res.cloudinary.com");

    if (currentImageUrl && !replacingCloudinary) {
      return NextResponse.json({ status: "skipped", reason: "existing_image" });
    }

    const candidates = await searchProductImages(product.name);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "이미지 검색 결과가 없습니다." }, { status: 422 });
    }

    const imageUrl = candidates[0];

    const updated = await prisma.product.updateMany({
      where: {
        id: product.id,
        imageUrl: product.imageUrl,
      },
      data: { imageUrl },
    });

    if (updated.count === 0) {
      return NextResponse.json({ status: "skipped", reason: "existing_image" });
    }

    await createAuditLog({
      action: "UPDATE",
      entity: "Product",
      entityId: product.id,
      changes: {
        imageUrl,
        source: replacingCloudinary
          ? "naver_cloudinary_image_replacement"
          : "naver_bulk_image_registration",
      },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ status: "success", imageUrl, replacedCloudinary: replacingCloudinary });
  } catch (error) {
    console.error("[POST /api/admin/products/images]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 자동 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
