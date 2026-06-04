import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 기존 주문 품목에 productName 채우기 (스키마 마이그레이션 후 1회 실행) */
async function main() {
  const items = await prisma.orderItem.findMany({ include: { product: true } });
  let updated = 0;

  for (const item of items) {
    const name = item.product?.name ?? item.productName;
    if (!name) continue;
    if (item.productName !== name) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { productName: name },
      });
      updated++;
    }
  }

  console.log(`✅ 주문 품목 ${items.length}건 중 ${updated}건 productName 반영`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
