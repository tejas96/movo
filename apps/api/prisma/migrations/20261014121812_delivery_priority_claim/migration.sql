-- Push outbox: send EMERGENCY first and let several senders share the work.
-- priority orders the queue (0 EMERGENCY, 1 MEMBERSHIP/SYSTEM, 2 day-to-day, 3 MAINTENANCE/EXPENSE);
-- claimedUntil marks a row a sender is working on. Both are additive with safe defaults, so the
-- running (old) API keeps working while this migrates.

-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "claimedUntil" TIMESTAMP(3),
ADD COLUMN     "priority" SMALLINT NOT NULL DEFAULT 2;

-- Rows still waiting get their real priority.
UPDATE "NotificationDelivery" d
SET "priority" = CASE n."category"
    WHEN 'EMERGENCY' THEN 0
    WHEN 'MEMBERSHIP' THEN 1
    WHEN 'SYSTEM' THEN 1
    WHEN 'MAINTENANCE' THEN 3
    WHEN 'EXPENSE' THEN 3
    ELSE 2 END
FROM "Notification" n
WHERE n."id" = d."notificationId" AND d."status" = 'PENDING';

-- CreateIndex (replaces the (status, createdAt) index the queue used before)
CREATE INDEX "NotificationDelivery_status_priority_createdAt_idx" ON "NotificationDelivery"("status", "priority", "createdAt");

-- DropIndex
DROP INDEX "NotificationDelivery_status_createdAt_idx";
