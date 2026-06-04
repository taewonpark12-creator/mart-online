import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const products = Array.isArray(body) ? body : [body];

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "상품 배열이 필요합니다." }, { status: 400 });
    }

    const validProducts = products
      .filter((item: any) => item.name && item.price)
      .map((item: any) => ({
        name: String(item.name).trim(),
        description: item.description ? String(item.description).trim() : null,
        barcode: item.barcode ? String(item.barcode).trim() : null,
        price: Number(item.price) || 0,
        category: item.category ? String(item.category) : "미분류",
        imageUrl: item.imageUrl ? String(item.imageUrl).trim() : null,
        stock: Number(item.stock) || 0,
        isRecommended: Boolean(item.isRecommended),
        isOnlineExclusive: Boolean(item.isOnlineExclusive),
        isOutOfStock: Boolean(item.isOutOfStock),
      }));

    if (validProducts.length === 0) {
      return NextResponse.json({ error: "유효한 상품이 없습니다." }, { status: 400 });
    }

    // 바코드가 있는 상품들의 바코드 목록 추출
    const barcodes = validProducts
      .map((p) => p.barcode)
      .filter((b): b is string => b !== null && b !== "");

    // 기존 상품 조회
    const existingProducts = barcodes.length > 0
      ? await prisma.product.findMany({
          where: {
            barcode: { in: barcodes },
          },
        })
      : [];

    // 바코드별 기존 상품 Map 생성
    const existingByBarcode = new Map(
      existingProducts.map((p) => [p.barcode, p])
    );

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // 각 상품 처리
    for (const product of validProducts) {
      // 바코드가 없으면 항상 생성
      if (!product.barcode) {
        await prisma.product.create({
          data: product,
        });
        createdCount++;
        continue;
      }

      // 바코드가 있는 경우 기존 상품 확인
      const existing = existingByBarcode.get(product.barcode);

      if (existing) {
        // 가격이 동일하면 스킵
        if (Number(existing.price) === Number(product.price)) {
          skippedCount++;
          continue;
        }

        // 가격이 다르면 업데이트
        await prisma.product.update({
          where: { id: existing.id },
          data: { price: product.price },
        });
        updatedCount++;
      } else {
        // 신규 상품 생성
        await prisma.product.create({
          data: product,
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: createdCount + updatedCount + skippedCount,
    });
  } catch (error) {
    console.error("Bulk Products API Error:", error);
    return NextResponse.json({ error: "상품 일괄 등록에 실패했습니다." }, { status: 500 });
  }
}
