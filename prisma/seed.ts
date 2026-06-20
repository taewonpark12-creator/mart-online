import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 기존의 모든 데이터를 삭제하여 깨끗한 상태로 만듭니다.
  // 실제 운영 중에는 이 파일을 실행하지 않도록 주의하세요!
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  // await prisma.product.deleteMany(); // 상품은 삭제하지 않음

  console.log("✅ 모든 주문 데이터를 삭제했습니다.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());