import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeInput } from "@/lib/security";

type PriceItem = {
  barcode: string;
  name?: string;
  normalPrice: number;
  eventPrice?: number | null;
  discountRate?: number | null;
};

function loadPrices(): PriceItem[] {
  const filePath = path.join(process.cwd(), "public", "prices.json");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PriceItem[]) : [];
  } catch (error) {
    console.error("[POST /api/products/bulk] prices.json parse failed", error);
    return [];
  }
}

function toSafeBarcode(value: unknown): string {
  return sanitizeInput(String(value ?? "")).slice(0, 64).trim();
}

function toSafePrice(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) {
    return 0;
  }
  return Math.floor(next);
}

function getRequestBarcodes(body: unknown) {
  const rows =
    typeof body === "object" &&
    body !== null &&
    "barcodes" in body &&
    Array.isArray((body as { barcodes?: unknown }).barcodes)
      ? (body as { barcodes: unknown[] }).barcodes
      : Array.isArray(body)
        ? body
        : [body];

  return rows
    .map((item: unknown) => {
      if (typeof item === "string" || typeof item === "number") {
        return toSafeBarcode(item);
      }

      if (typeof item === "object" && item !== null) {
        const row = item as Record<string, unknown>;
        return toSafeBarcode(row.barcode ?? row.BarCode ?? row["바코드"] ?? row[0] ?? "");
      }

      return "";
    })
    .filter((barcode) => barcode.length > 0);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const uniqueBarcodes = Array.from(new Set(getRequestBarcodes(body)));

    if (uniqueBarcodes.length === 0) {
      return NextResponse.json({ error: "등록할 바코드가 없습니다." }, { status: 400 });
    }

    const priceByBarcode = new Map(
      loadPrices()
        .map((item) => [toSafeBarcode(item.barcode), item] as const)
        .filter(([barcode]) => barcode.length > 0),
    );

    const existingProducts = await prisma.product.findMany({
      where: {
        barcode: { in: uniqueBarcodes },
      },
    });
    const existingByBarcode = new Map(
      existingProducts
        .filter((product) => product.barcode)
        .map((product) => [String(product.barcode).trim(), product]),
    );

    let createdCount = 0;
    let updatedCount = 0;
    const notFoundBarcodes: string[] = [];

    for (const barcode of uniqueBarcodes) {
      const priceInfo = priceByBarcode.get(barcode);

      if (!priceInfo) {
        notFoundBarcodes.push(barcode);
        continue;
      }

      const productData = {
        barcode,
        name: sanitizeInput(String(priceInfo.name ?? barcode)).slice(0, 100) || barcode,
        price: toSafePrice(priceInfo.normalPrice),
      };
      const existingProduct = existingByBarcode.get(barcode);

      if (existingProduct) {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: productData,
        });
        updatedCount++;
        continue;
      }

      await prisma.product.create({
        data: {
          ...productData,
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
      updated: updatedCount,
      success: createdCount + updatedCount,
      notFound: notFoundBarcodes.length,
      notFoundBarcodes,
      total: uniqueBarcodes.length,
    });
  } catch (error) {
    console.error("[POST /api/products/bulk]", error);
    return NextResponse.json({ error: "상품 일괄 등록에 실패했습니다." }, { status: 500 });
  }
}
