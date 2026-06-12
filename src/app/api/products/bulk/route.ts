import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import fs from "fs";
import path from "path";

type PriceItem = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice: number | null;
  discountRate?: number | null;
};

function loadPrices(): PriceItem[] {
  const filePath = path.join(process.cwd(), "public", "prices.json");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as PriceItem[];
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];

    const prices = loadPrices();
    const priceByBarcode = new Map(
      prices.map((item) => [String(item.barcode).trim(), item])
    );

    const barcodes = rows
      .map((item: any) => {
        if (typeof item === "string" || typeof item === "number") {
          return String(item).trim();
        }

        return String(
          item.barcode ??
          item.BarCode ??
          item["바코드"] ??
          item[0] ??
          ""
        ).trim();
      })
      .filter((barcode) => barcode.length > 0);

    if (barcodes.length === 0) {
      return NextResponse.json(
        { error: "등록할 바코드가 없습니다." },
        { status: 400 }
      );
    }

    const uniqueBarcodes = Array.from(new Set(barcodes));

    const existingProducts = await prisma.product.findMany({
      where: {
        barcode: { in: uniqueBarcodes },
      },
    });

    const existingByBarcode = new Map(
      existingProducts
        .filter((p) => p.barcode)
        .map((p) => [String(p.barcode).trim(), p])
    );

    let createdCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    const notFoundBarcodes: string[] = [];

    for (const barcode of uniqueBarcodes) {
      if (existingByBarcode.has(barcode)) {
        skippedCount++;
        continue;
      }

      const priceInfo = priceByBarcode.get(barcode);

      if (!priceInfo) {
        notFoundCount++;
        notFoundBarcodes.push(barcode);
        continue;
      }

      await prisma.product.create({
        data: {
          barcode,
          name: priceInfo.name || barcode,
          price: Number(priceInfo.normalPrice) || 0,
          category: "미분류",
          description: null,
          imageUrl: null,
          stock: 0,
          isRecommended: false,
          isOnlineExclusive: false,
          isPopular: false,
          isOutOfStock: false,
        },
      });

      createdCount++;
    }

    return NextResponse.json({
      created: createdCount,
      skipped: skippedCount,
      notFound: notFoundCount,
      notFoundBarcodes,
      total: uniqueBarcodes.length,
    });
  } catch (error) {
    console.error("Bulk Products API Error:", error);
    return NextResponse.json(
      { error: "상품 일괄 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}