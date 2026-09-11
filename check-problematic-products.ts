import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking problematic products in DB ===\n');

  // 1. Direct query for 포도 and 흑찰옥수수
  const problematicProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: '포도' } },
        { name: { contains: '찰옥수수' } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
      isRecommended: true,
      isPopular: true,
      isOnlineExclusive: true,
      barcode: true,
    },
  });

  console.log('1. Direct DB query for 포도 and 찰옥수수:');
  console.log(JSON.stringify(problematicProducts, null, 2));

  // 2. Query with category = "과일/채소" and default filters
  const withCategoryDefault = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      isActive: true,
      isOutOfStock: false,
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });

  console.log('\n2. Query with category="과일/채소", isActive=true, isOutOfStock=false:');
  console.log(`Total count: ${withCategoryDefault.length}`);
  const 포도InCategoryDefault = withCategoryDefault.some(p => p.name.includes('포도'));
  const 찰옥수수InCategoryDefault = withCategoryDefault.some(p => p.name.includes('찰옥수수'));
  console.log(`포도 in result: ${포도InCategoryDefault}`);
  console.log(`찰옥수수 in result: ${찰옥수수InCategoryDefault}`);

  // 3. Query with category = "과일/채소" and includeOutOfStock filters
  const withCategoryIncludeOutOfStock = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });

  console.log('\n3. Query with category="과일/채소", isActive=true (no isOutOfStock filter):');
  console.log(`Total count: ${withCategoryIncludeOutOfStock.length}`);
  const 포도InCategoryInclude = withCategoryIncludeOutOfStock.some(p => p.name.includes('포도'));
  const 찰옥수수InCategoryInclude = withCategoryIncludeOutOfStock.some(p => p.name.includes('찰옥수수'));
  console.log(`포도 in result: ${포도InCategoryInclude}`);
  console.log(`찰옥수수 in result: ${찰옥수수InCategoryInclude}`);

  // 4. Query with category = "과일/채소", activeOnly=false, includeOutOfStock=true
  const withCategoryAll = await prisma.product.findMany({
    where: {
      category: '과일/채소',
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });

  console.log('\n4. Query with category="과일/채소" (no filters):');
  console.log(`Total count: ${withCategoryAll.length}`);
  const 포도InCategoryAll = withCategoryAll.some(p => p.name.includes('포도'));
  const 찰옥수수InCategoryAll = withCategoryAll.some(p => p.name.includes('찰옥수수'));
  console.log(`포도 in result: ${포도InCategoryAll}`);
  console.log(`찰옥수수 in result: ${찰옥수수InCategoryAll}`);

  // 5. Check if they appear in the category when searched
  const searchInCategory = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      OR: [
        { name: { contains: '포도', mode: 'insensitive' } },
        { name: { contains: '찰옥수수', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });

  console.log('\n5. Search within category="과일/채소" for 포도/찰옥수수:');
  console.log(JSON.stringify(searchInCategory, null, 2));

  // 6. Compare with a normal product in the same category
  const normalProducts = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      name: { not: { contains: '포도' } },
      name: { not: { contains: '찰옥수수' } },
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
    take: 3,
  });

  console.log('\n6. Sample normal products in category="과일/채소":');
  console.log(JSON.stringify(normalProducts, null, 2));
}

main()
  .then(() => {
    console.log('\n=== Check complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
