import Database from 'better-sqlite3';
import { PrismaClient } from "@prisma/client";

// 로컬 SQLite 데이터베이스 직접 연결
const localDb = new Database('./prisma/dev.db');

// Neon PostgreSQL 데이터베이스에 데이터 쓰기
const neonPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_wqXNS0Cbh6Kp@ep-plain-smoke-aqxfwfbu-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
    },
  },
});

async function main() {
  console.log("📦 로컬 SQLite 데이터베이스에서 데이터 읽기...");

  // 로컬에서 상품 데이터 읽기
  const products = localDb.prepare('SELECT * FROM Product').all();
  console.log(`📦 ${products.length}개의 상품을 찾았습니다.`);

  // 데이터 변환
  const productData = products.map((product: any) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: BigInt(product.price),
    stock: product.stock,
    imageUrl: product.imageUrl,
    barcode: product.barcode,
    isActive: product.isActive === 1,
    isRecommended: product.isRecommended === 1,
    isOutOfStock: product.isOutOfStock === 1,
    maxOrderQuantity: product.maxOrderQuantity,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  }));

  console.log("📦 Neon에 상품 데이터 일괄 쓰기 시작...");

  // 일괄 처리 (100개씩 나누어서)
  const batchSize = 100;
  for (let i = 0; i < productData.length; i += batchSize) {
    const batch = productData.slice(i, i + batchSize);
    await neonPrisma.product.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`📦 ${Math.min(i + batchSize, productData.length)}/${productData.length}개 상품 이전 완료`);
  }

  console.log(`✅ ${productData.length}개의 상품을 Neon에 이전했습니다.`);
  console.log("🎉 데이터 이전 완료!");
}

main()
  .catch(console.error)
  .finally(async () => {
    localDb.close();
    await neonPrisma.$disconnect();
  });