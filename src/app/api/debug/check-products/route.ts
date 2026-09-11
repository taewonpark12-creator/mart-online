import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

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

    // 2. Query with category = "과일/채소" and default filters (what the admin page uses)
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

    // 3. Query with category = "과일/채소" with admin page filters (activeOnly=false, includeOutOfStock=true)
    const withCategoryAdminFilters = await prisma.product.findMany({
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

    // 4. Check if they appear in the category when searched
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

    // 5. Get all unique categories from DB
    const allCategories = await prisma.product.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    return NextResponse.json({
      problematicProducts,
      withCategoryDefault: {
        count: withCategoryDefault.length,
        has포도: withCategoryDefault.some(p => p.name.includes('포도')),
        has찰옥수수: withCategoryDefault.some(p => p.name.includes('찰옥수수')),
        sample: withCategoryDefault.slice(0, 5),
      },
      withCategoryAdminFilters: {
        count: withCategoryAdminFilters.length,
        has포도: withCategoryAdminFilters.some(p => p.name.includes('포도')),
        has찰옥수수: withCategoryAdminFilters.some(p => p.name.includes('찰옥수수')),
        sample: withCategoryAdminFilters.slice(0, 5),
      },
      searchInCategory,
      allCategories: allCategories.map(c => c.category),
    });
  } catch (error) {
    console.error("Debug check error:", error);
    return NextResponse.json({ error: "Debug check failed" }, { status: 500 });
  }
}
