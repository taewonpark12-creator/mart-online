CREATE TABLE "FlyerAnnouncement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FlyerAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FlyerAnnouncement_isActive_idx" ON "FlyerAnnouncement"("isActive");
CREATE INDEX "FlyerAnnouncement_updatedAt_idx" ON "FlyerAnnouncement"("updatedAt");
CREATE UNIQUE INDEX "FlyerAnnouncement_one_active_idx"
  ON "FlyerAnnouncement"("isActive")
  WHERE "isActive" = true;
