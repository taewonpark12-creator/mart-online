CREATE TYPE "OrderItemStatus" AS ENUM ('ACTIVE', 'CANCELLED');

ALTER TABLE "OrderItem"
  ADD COLUMN "itemStatus" "OrderItemStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "OrderItem_itemStatus_idx" ON "OrderItem"("itemStatus");
