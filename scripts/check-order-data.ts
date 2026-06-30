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

function redactDatabaseUrl(value: string | undefined) {
  if (!value) return "<not set>";

  try {
    const url = new URL(value);
    const database = url.pathname || "";
    return `${url.protocol}//***@${url.host}${database}`;
  } catch {
    return "<set, unparseable>";
  }
}

async function main() {
  for (const file of ENV_FILES) {
    loadEnvFile(file);
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      JSON.stringify(
        {
          databaseUrl: "<not set>",
          error: "DATABASE_URL is not set.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();

  try {
    const [orderCount, orderItemCount, latestOrder, statusCounts, itemStatusColumnRows] =
      await Promise.all([
        prisma.order.count(),
        prisma.orderItem.count(),
        prisma.order.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.order.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'OrderItem'
              AND column_name = 'itemStatus'
          ) AS "exists"
        `,
      ]);
    const itemStatusColumnExists = Boolean(itemStatusColumnRows[0]?.exists);
    const itemStatusCounts = itemStatusColumnExists
      ? await prisma.$queryRaw<Array<{ itemStatus: string | null; count: bigint }>>`
          SELECT "itemStatus", COUNT(*) AS "count"
          FROM "OrderItem"
          GROUP BY "itemStatus"
          ORDER BY "itemStatus" NULLS FIRST
        `
      : [];
    const ordersWithOnlyCancelledItems = itemStatusColumnExists
      ? await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS "count"
          FROM "Order" o
          WHERE EXISTS (
            SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = o.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "OrderItem" oi
            WHERE oi."orderId" = o.id
              AND (oi."itemStatus" IS NULL OR oi."itemStatus" <> 'CANCELLED')
          )
        `
      : [];
    const adminOrdersReturnedCount = await prisma.order.count();

    console.log(
      JSON.stringify(
        {
          databaseUrl: redactDatabaseUrl(process.env.DATABASE_URL),
          orderCount,
          orderItemCount,
          statusCounts: Object.fromEntries(
            statusCounts.map((row) => [row.status, row._count._all]),
          ),
          latestOrderCreatedAt: latestOrder?.createdAt?.toISOString() ?? null,
          orderItemItemStatusColumnExists: itemStatusColumnExists,
          orderItemStatusCounts: Object.fromEntries(
            itemStatusCounts.map((row) => [
              row.itemStatus ?? "NULL",
              Number(row.count),
            ]),
          ),
          adminOrdersBaseQueryReturnedCount: adminOrdersReturnedCount,
          excludedByAdminOrdersBaseWhere: orderCount - adminOrdersReturnedCount,
          ordersWithOnlyCancelledItems: Number(ordersWithOnlyCancelledItems[0]?.count ?? 0),
          adminOrdersLikelyFailsBecauseItemStatusColumnMissing: !itemStatusColumnExists,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Order data check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
