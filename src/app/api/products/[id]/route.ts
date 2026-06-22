import { unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteProductById } from "@/lib/product-delete";
import { isProductImagePath } from "@/lib/upload";
import { createAuditLog } from "@/lib/audit";
import { sanitizeInput, validateAmount } from "@/lib/security";

type Params = { params: Promise<{ id: string }> };

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(0, Math.floor(next));
}

function toOptionalPositiveInt(value: unknown): number | null {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    return null;
  }
  return Math.floor(next);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const nextImageUrl =
      body.imageUrl !== undefined
        ? sanitizeInput(String(body.imageUrl ?? "")).slice(0, 2000) || null
        : existing.imageUrl;
    const nextName =
      body.name !== undefined ? sanitizeInput(String(body.name ?? "")).slice(0, 100) : undefined;
    const nextCategory =
      body.category !== undefined ? sanitizeInput(String(body.category ?? "")).slice(0, 50) : undefined;
    const nextDescription =
      body.description !== undefined
        ? sanitizeInput(String(body.description ?? "")).slice(0, 500) || null
        : undefined;
    const nextBarcode =
      body.barcode !== undefined ? sanitizeInput(String(body.barcode ?? "")).slice(0, 64) || null : undefined;

    if (nextName !== undefined && nextName.length === 0) {
      return NextResponse.json({ error: "상품명을 입력해주세요." }, { status: 400 });
    }

    if (nextCategory !== undefined && nextCategory.length === 0) {
      return NextResponse.json({ error: "카테고리를 입력해주세요." }, { status: 400 });
    }

    const updateData: any = {
      ...(nextName !== undefined && { name: nextName }),
      ...(nextDescription !== undefined && { description: nextDescription }),
      ...(nextBarcode !== undefined && { barcode: nextBarcode }),
      ...(nextCategory !== undefined && { category: nextCategory }),
      ...(body.imageUrl !== undefined && { imageUrl: nextImageUrl }),
      ...(body.stock !== undefined && { stock: toNonNegativeInt(body.stock, existing.stock) }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      ...(body.isRecommended !== undefined && { isRecommended: Boolean(body.isRecommended) }),
      ...(body.isOnlineExclusive !== undefined && { isOnlineExclusive: Boolean(body.isOnlineExclusive) }),
      // @ts-ignore - Prisma client not regenerated yet
      ...(body.isPopular !== undefined && { isPopular: Boolean(body.isPopular) }),
      ...(body.isOutOfStock !== undefined && { isOutOfStock: Boolean(body.isOutOfStock) }),
      ...(body.maxOrderQuantity !== undefined && {
        maxOrderQuantity: toOptionalPositiveInt(body.maxOrderQuantity),
      }),
      ...(body.recommendedOrder !== undefined && {
        recommendedOrder: toNonNegativeInt(body.recommendedOrder),
      }),
      // @ts-ignore - Prisma client not regenerated yet
      ...(body.popularOrder !== undefined && {
        popularOrder: toNonNegativeInt(body.popularOrder),
      }),
    };

    if (body.price !== undefined) {
      const nextPrice = Number(body.price);
      if (!validateAmount(nextPrice)) {
        return NextResponse.json({ error: "상품 가격을 올바르게 입력해주세요." }, { status: 400 });
      }
      updateData.price = BigInt(Math.floor(nextPrice));
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      action: "UPDATE",
      entity: "Product",
      entityId: id,
      changes: updateData,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    if (
      body.imageUrl !== undefined &&
      existing.imageUrl &&
      existing.imageUrl !== nextImageUrl &&
      isProductImagePath(existing.imageUrl)
    ) {
      const oldPath = path.join(process.cwd(), "public", existing.imageUrl);
      try {
        await unlink(oldPath);
      } catch {
        // Ignore missing previous local image files.
      }
    }

    return NextResponse.json({
      ...product,
      price: product.price.toString(),
    });
  } catch (error) {
    console.error("[PATCH /api/products/[id]]", error);
    return NextResponse.json({ error: "상품 업데이트 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteProductById(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await createAuditLog({
    action: "DELETE",
    entity: "Product",
    entityId: id,
    changes: { name: result.name },
    ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ success: true, id: result.id, name: result.name });
}
