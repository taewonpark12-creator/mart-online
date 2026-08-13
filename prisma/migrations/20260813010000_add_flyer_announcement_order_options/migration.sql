ALTER TABLE "FlyerAnnouncement"
  ADD COLUMN "showOnlineOrder" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPhoneOrder" BOOLEAN NOT NULL DEFAULT true;
