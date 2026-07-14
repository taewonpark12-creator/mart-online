import { PrismaClient } from "@prisma/client";

function ensureDestructiveAllowed() {
  if (process.env.ALLOW_DESTRUCTIVE !== "true") {
    console.log("Blocked: set ALLOW_DESTRUCTIVE=true to run this destructive seed script.");
    return false;
  }

  return true;
}

async function main() {
  if (!ensureDestructiveAllowed()) {
    return;
  }

  const prisma = new PrismaClient();

  try {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();

    console.log("Order seed cleanup completed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
