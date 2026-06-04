import { unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteProductById } from "@/lib/product-delete";
import { isProductImagePath } from "@/lib/upload";
import { createAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

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
      body.imageUrl !== undefined ? body.imageUrl?.trim() || null : existing.imageUrl;

    const updateData: any = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.barcode !== undefined && { barcode: body.barcode?.trim() || null }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.imageUrl !== undefined && { imageUrl: nextImageUrl }),
      ...(body.stock !== undefined && { stock: Number(body.stock) }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      ...(body.isRecommended !== undefined && { isRecommended: Boolean(body.isRecommended) }),
      ...(body.isOnlineExclusive !== undefined && { isOnlineExclusive: Boolean(body.isOnlineExclusive) }),
      ...(body.isOutOfStock !== undefined && { isOutOfStock: Boolean(body.isOutOfStock) }),
      ...(body.maxOrderQuantity !== undefined && {
        maxOrderQuantity: body.maxOrderQuantity && body.maxOrderQuantity > 0 ? Number(body.maxOrderQuantity) : null,
      }),
      ...(body.recommendedOrder !== undefined && {
        recommendedOrder: Number(body.recommendedOrder) || 0,
      }),
    };

    if (body.price !== undefined) {
      updateData.price = BigInt(body.price);
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Audit Log 기록
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
        /* 이전 파일이 없으면 무시 */
      }
    }

    // BigInt를 문자열로 변환하여 JSON 직렬화 문제 해결
    const serializedProduct = {
      ...product,
      price: product.price.toString(),
    };

    return NextResponse.json(serializedProduct);
  } catch (error) {
    console.error("상품 업데이트 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "상품 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
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

  // Audit Log 기록
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