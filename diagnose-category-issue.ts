import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const ENV_FILES = [".env.local", ".env"];

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

// Load environment variables
for (const file of ENV_FILES) {
  loadEnvFile(file);
}

console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
  console.log('=== 진단 시작: 과일/채소 카테고리에서 포도/흑찰옥수수 누락 문제 ===\n');

  // 1. DB 직접 조회 - 포도
  console.log('[1] 포도 직접 조회 (name contains "포도")');
  const 포도Products = await prisma.product.findMany({
    where: {
      name: { contains: '포도' },
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
      barcode: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(`결과: ${포도Products.length}개`);
  console.log(JSON.stringify(포도Products, null, 2));

  // 2. DB 직접 조회 - 흑찰옥수수
  console.log('\n[2] 흑찰옥수수 직접 조회 (name contains "흑찰옥수수")');
  const 흑찰옥수수Products = await prisma.product.findMany({
    where: {
      name: { contains: '흑찰옥수수' },
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
      barcode: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(`결과: ${흑찰옥수수Products.length}개`);
  console.log(JSON.stringify(흑찰옥수수Products, null, 2));

  // 3. category = "과일/채소" 조회
  console.log('\n[3] category = "과일/채소" 조회');
  const 과일채소Products = await prisma.product.findMany({
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
  console.log(`결과: ${과일채소Products.length}개`);
  console.log('샘플 (처음 5개):');
  console.log(JSON.stringify(과일채소Products.slice(0, 5), null, 2));

  // 4. category = "과일/채소" AND name contains "포도"
  console.log('\n[4] category = "과일/채소" AND name contains "포도"');
  const 과일채소포도 = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      name: { contains: '포도' },
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });
  console.log(`결과: ${과일채소포도.length}개`);
  console.log(JSON.stringify(과일채소포도, null, 2));

  // 5. category = "과일/채소" AND name contains "흑찰옥수수"
  console.log('\n[5] category = "과일/채소" AND name contains "흑찰옥수수"');
  const 과일채소흑찰옥수수 = await prisma.product.findMany({
    where: {
      category: '과일/채소',
      name: { contains: '흑찰옥수수' },
    },
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });
  console.log(`결과: ${과일채소흑찰옥수수.length}개`);
  console.log(JSON.stringify(과일채소흑찰옥수수, null, 2));

  // 6. category 실제 값 확인 (모든 카테고리)
  console.log('\n[6] DB에 저장된 모든 category 값');
  const allCategories = await prisma.product.findMany({
    select: {
      category: true,
    },
    distinct: ['category'],
    orderBy: {
      category: 'asc',
    },
  });
  console.log('카테고리 목록:');
  allCategories.forEach(c => {
    console.log(`  "${c.category}" (길이: ${c.category.length})`);
  });

  // 7. category = "과일/채소" with admin page filters (activeOnly=false, includeOutOfStock=true)
  console.log('\n[7] category = "과일/채소" with admin page filters (no isActive/isOutOfStock filters)');
  const 과일채소AdminFilters = await prisma.product.findMany({
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
  console.log(`결과: ${과일채소AdminFilters.length}개`);
  const has포도 = 과일채소AdminFilters.some(p => p.name.includes('포도'));
  const has흑찰옥수수 = 과일채소AdminFilters.some(p => p.name.includes('흑찰옥수수'));
  console.log(`포도 포함: ${has포도}`);
  console.log(`흑찰옥수수 포함: ${has흑찰옥수수}`);

  // 8. pagination 테스트 - take 없이 전체
  console.log('\n[8] category = "과일/채소" without pagination (take 없음)');
  const 과일채소NoPagination = await prisma.product.findMany({
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
  console.log(`결과: ${과일채소NoPagination.length}개`);
  console.log(`포도 포함: ${과일채소NoPagination.some(p => p.name.includes('포도'))}`);
  console.log(`흑찰옥수수 포함: ${과일채소NoPagination.some(p => p.name.includes('흑찰옥수수'))}`);

  // 9. pagination 테스트 - 현재 PAGE_SIZE (100) 적용
  const PAGE_SIZE = 100;
  console.log(`\n[9] category = "과일/채소" with take=${PAGE_SIZE}`);
  const 과일채소WithTake = await prisma.product.findMany({
    where: {
      category: '과일/채소',
    },
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });
  console.log(`결과: ${과일채소WithTake.length}개`);
  console.log(`포도 포함: ${과일채소WithTake.some(p =>p.name.includes('포도'))}`);
  console.log(`흑찰옥수수 포함: ${과일채소WithTake.some(p => p.name.includes('흑찰옥수수'))}`);

  // 10. 정렬 순서 확인
  console.log('\n[10] category = "과일/채소" with orderBy (category asc, name asc)');
  const 과일채소Sorted = await prisma.product.findMany({
    where: {
      category: '과일/채소',
    },
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      isOutOfStock: true,
    },
  });
  console.log(`결과: ${과일채소Sorted.length}개`);
  console.log('정렬된 상품명 (처음 20개):');
  과일채소Sorted.slice(0, 20).forEach(p => {
    console.log(`  ${p.name}`);
  });
  console.log(`포도 포함: ${과일채소Sorted.some(p => p.name.includes('포도'))}`);
  console.log(`흑찰옥수수 포함: ${과일채소Sorted.some(p => p.name.includes('흑찰옥수수'))}`);

  // 11. 포도와 흑찰옥수수의 실제 category 값 확인
  console.log('\n[11] 포도와 흑찰옥수수의 실제 category 값');
  const all포도찰옥수수 = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: '포도' } },
        { name: { contains: '흑찰옥수수' } },
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
  all포도찰옥수수.forEach(p => {
    console.log(`  ${p.name}: category="${p.category}" (길이:${p.category.length}), isActive=${p.isActive}, isOutOfStock=${p.isOutOfStock}`);
  });

  console.log('\n=== 진단 완료 ===');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
