import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DB Statistics ===\n');

  // 1. Table row counts
  console.log('1. Table Row Counts:');
  const orderCount = await prisma.order.count();
  const orderItemCount = await prisma.orderItem.count();
  const productCount = await prisma.product.count();
  console.log(`   Order: ${orderCount} rows`);
  console.log(`   OrderItem: ${orderItemCount} rows`);
  console.log(`   Product: ${productCount} rows`);

  // 2. Table sizes (using raw query)
  console.log('\n2. Table Sizes:');
  const tableSizes = await prisma.$queryRaw<Array<{tablename: string, pg_size_pretty: string}>>`
    SELECT 
      tablename,
      pg_size_pretty(pg_total_relation_size(quote_ident(tablename::text))) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('Order', 'OrderItem', 'Product')
    ORDER BY pg_total_relation_size(quote_ident(tablename::text)) DESC
  `;
  for (const table of tableSizes) {
    console.log(`   ${table.tablename}: ${table.pg_size_pretty}`);
  }

  // 3. Index sizes
  console.log('\n3. Index Sizes:');
  const indexSizes = await prisma.$queryRaw<Array<{indexname: string, tablename: string, pg_size_pretty: string}>>`
    SELECT 
      indexname,
      tablename,
      pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('Order', 'OrderItem', 'Product')
    ORDER BY pg_relation_size(indexrelid) DESC
  `;
  for (const index of indexSizes) {
    console.log(`   ${index.tablename}.${index.indexname}: ${index.pg_size_pretty}`);
  }

  // 4. All indexes on Order, OrderItem, Product
  console.log('\n4. All Indexes:');
  const allIndexes = await prisma.$queryRaw<Array<{indexname: string, tablename: string, indexdef: string}>>`
    SELECT 
      indexname,
      tablename,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('Order', 'OrderItem', 'Product')
    ORDER BY tablename, indexname
  `;
  for (const index of allIndexes) {
    console.log(`   ${index.tablename}.${index.indexname}:`);
    console.log(`     ${index.indexdef}`);
  }

  // 5. Check if pg_stat_statements is available
  console.log('\n5. pg_stat_statements Availability:');
  try {
    const pgStatStatements = await prisma.$queryRaw<Array<{extname: string}>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'
    `;
    if (pgStatStatements.length > 0) {
      console.log('   pg_stat_statements: ENABLED');
      
      // Get top queries by total execution time
      const topQueries = await prisma.$queryRaw<Array<{query: string, calls: bigint, total_exec_time: number, mean_exec_time: number, rows: bigint, shared_blks_hit: bigint, shared_blks_read: bigint}>>`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          rows,
          shared_blks_hit,
          shared_blks_read
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 10
      `;
      console.log('\n   Top 10 Queries by Total Execution Time:');
      for (const q of topQueries) {
        console.log(`   Calls: ${q.calls}, Total Time: ${q.total_exec_time}ms, Mean Time: ${q.mean_exec_time}ms`);
        console.log(`   Rows: ${q.rows}, Cache Hit: ${q.shared_blks_hit}, Cache Read: ${q.shared_blks_read}`);
        console.log(`   Query: ${q.query.substring(0, 100)}...`);
        console.log('');
      }
    } else {
      console.log('   pg_stat_statements: NOT ENABLED');
    }
  } catch (error) {
    console.log('   pg_stat_statements: NOT AVAILABLE OR ERROR');
    console.log(`   Error: ${error}`);
  }

  // 6. EXPLAIN for /api/admin/orders query
  console.log('\n6. EXPLAIN for /api/admin/orders query:');
  try {
    const explain = await prisma.$queryRaw<Array<{QUERY_PLAN: string}>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT 
        "Order".id, "Order".customerName, "Order".customerPhone, 
        "Order".fulfillmentType, "Order".status, "Order".totalAmount, 
        "Order".createdAt,
        "OrderItem".itemStatus, "OrderItem".cancelledQuantity
      FROM "Order" 
      LEFT JOIN "OrderItem" ON "OrderItem"."orderId" = "Order"."id"
      ORDER BY "Order"."createdAt" DESC
      LIMIT 100
    `;
    for (const line of explain) {
      console.log(`   ${line.QUERY_PLAN}`);
    }
  } catch (error) {
    console.log('   EXPLAIN failed:', error);
  }

  // 7. Database size
  console.log('\n7. Database Size:');
  const dbSize = await prisma.$queryRaw<Array<{pg_size_pretty: string}>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `;
  console.log(`   Total: ${dbSize[0].pg_size_pretty}`);

  // 8. Connection stats
  console.log('\n8. Connection Stats:');
  const connStats = await prisma.$queryRaw<Array<{count: bigint}>>`
    SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
  `;
  console.log(`   Active connections: ${connStats[0].count}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
