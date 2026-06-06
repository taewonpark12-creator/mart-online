import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATEGORIES } from "../src/lib/types";

const prisma = new PrismaClient();

/**
 * 카테고리 유사도 계산 (간단한 문자열 포함 검사)
 */
function findMostSimilarCategory(
  category: string,
  validCategories: readonly string[]
): string {
  const lowerCategory = category.toLowerCase();

  // 정확히 일치하는 경우
  if (validCategories.includes(category)) {
    return category;
  }

  // 부분 일치하는 경우 (예: "쌀/잡곡" → "쌀/잡곡/견과")
  for (const validCat of validCategories) {
    if (validCat.includes(category) || category.includes(validCat)) {
      return validCat;
    }
  }

  // 슬래시로 분리하여 부분 일치 확인
  const categoryParts = category.split(/[\/·]/);
  for (const part of categoryParts) {
    if (part.trim()) {
      for (const validCat of validCategories) {
        const validCatParts = validCat.split(/[\/·]/);
        for (const validPart of validCatParts) {
          if (validPart === part) {
            return validCat;
          }
        }
      }
    }
  }

  // 유사하지 않은 경우 "미분류"로 처리
  return "미분류";
}

/**
 * 카테고리 정규화 마이그레이션
 */
async function migrateCategories() {
  console.log("=".repeat(50));
  console.log("카테고리 정규화 마이그레이션 시작");
  console.log("=".repeat(50));

  // 모든 상품 조회
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      category: true,
    },
  });

  console.log(`총 ${products.length}개 상품 조회됨`);

  // 카테고리 매핑 및 변경 필요한 상품 식별
  const updates: Array<{ id: string; oldCategory: string; newCategory: string }> = [];
  const categoryStats = new Map<string, number>();

  for (const product of products) {
    const currentCategory = product.category || "";
    const normalizedCategory = findMostSimilarCategory(currentCategory, PRODUCT_CATEGORIES);

    // 카테고리가 변경되어야 하는 경우
    if (currentCategory !== normalizedCategory) {
      updates.push({
        id: product.id,
        oldCategory: currentCategory,
        newCategory: normalizedCategory,
      });
    }

    // 통계
    categoryStats.set(normalizedCategory, (categoryStats.get(normalizedCategory) || 0) + 1);
  }

  console.log(`\n변경 필요한 상품: ${updates.length}개`);

  if (updates.length > 0) {
    console.log("\n변경될 카테고리 목록:");
    const changeSummary = new Map<string, { old: string[]; count: number }>();
    for (const update of updates) {
      if (!changeSummary.has(update.newCategory)) {
        changeSummary.set(update.newCategory, { old: [], count: 0 });
      }
      const summary = changeSummary.get(update.newCategory)!;
      if (!summary.old.includes(update.oldCategory)) {
        summary.old.push(update.oldCategory);
      }
      summary.count++;
    }

    for (const [newCat, summary] of changeSummary.entries()) {
      console.log(`  ${newCat}: ${summary.count}개 (기존: ${summary.old.join(", ")})`);
    }

    console.log("\n일괄 업데이트 시작...");
    
    // 카테고리별로 그룹화하여 일괄 업데이트
    const updatesByCategory = new Map<string, string[]>();
    for (const update of updates) {
      if (!updatesByCategory.has(update.newCategory)) {
        updatesByCategory.set(update.newCategory, []);
      }
      updatesByCategory.get(update.newCategory)!.push(update.id);
    }

    let totalUpdated = 0;
    for (const [newCategory, ids] of updatesByCategory.entries()) {
      const result = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { category: newCategory },
      });
      totalUpdated += result.count;
      console.log(`  ${newCategory}: ${result.count}개 업데이트됨`);
    }

    console.log(`\n총 ${totalUpdated}개 상품 업데이트 완료`);
  } else {
    console.log("\n변경 필요한 상품이 없습니다.");
  }

  console.log("\n정규화 후 카테고리 분포:");
  for (const [category, count] of categoryStats.entries()) {
    console.log(`  ${category}: ${count}개`);
  }

  console.log("=".repeat(50));
  console.log("마이그레이션 완료");
  console.log("=".repeat(50));

  return {
    totalProducts: products.length,
    updatesNeeded: updates.length,
    updatesPerformed: updates.length,
  };
}

// 실행
migrateCategories()
  .then((result) => {
    console.log("\n결과:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("에러:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
