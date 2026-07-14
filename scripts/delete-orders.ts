import { PrismaClient } from '@prisma/client';

function ensureDestructiveAllowed() {
  if (process.env.ALLOW_DESTRUCTIVE !== "true") {
    console.log("Blocked: set ALLOW_DESTRUCTIVE=true to run this destructive order deletion script.");
    return false;
  }

  return true;
}

async function deleteAllOrders() {
  if (!ensureDestructiveAllowed()) {
    return;
  }

  const prisma = new PrismaClient();

  try {
    console.log('Starting to delete all orders...');

    // First, count the orders to be deleted
    const orderCount = await prisma.order.count();
    console.log(`Found ${orderCount} orders to delete`);

    if (orderCount === 0) {
      console.log('No orders to delete');
      return;
    }

    // Delete all orders (OrderItems will be cascade deleted automatically)
    const result = await prisma.order.deleteMany({});
    console.log(`Deleted ${result.count} orders`);

    // Verify deletion
    const remainingOrders = await prisma.order.count();
    const remainingOrderItems = await prisma.orderItem.count();

    console.log(`Remaining orders: ${remainingOrders}`);
    console.log(`Remaining order items: ${remainingOrderItems}`);

    if (remainingOrders === 0 && remainingOrderItems === 0) {
      console.log('✅ All orders and order items deleted successfully');
    } else {
      console.log('⚠️  Some data may remain');
    }
  } catch (error) {
    console.error('Error deleting orders:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllOrders()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
