import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isProductImagePath } from "@/lib/upload";

export type ProductDeleteResult =
  | { ok: true; id: string; name: string }
  | { ok: false; id: string; name: string; error: string };

export async function deleteProductById(id: string): Promise<ProductDeleteResult> {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    return { ok: false, id, name: "", error: "상품을 찾을 수 없습니다." };
  }

  if (product.imageUrl && isProductImagePath(product.imageUrl)) {
    const imagePath = path.join(process.cwd(), "public", product.imageUrl);
    try {
      await unlink(imagePath);
    } catch {
      /* 파일이 없으면 무시 */
    }
  }

  // 주문 품목은 productName 스냅샷 유지, productId만 SetNull
  await prisma.product.delete({ where: { id } });

  return { ok: true, id, name: product.name };
}
