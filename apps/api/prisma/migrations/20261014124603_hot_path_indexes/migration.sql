-- Indexes for hot paths (audit S6). Additive only; IF NOT EXISTS so a retried start is harmless.
-- MembershipRole(roleId): role member counts, ROLES audiences and permission recipients
--   (the primary key starts with membershipId, so lookups by role scanned the table).
-- Payment(societyId, createdAt DESC, id DESC): the payments list, newest first, keyset paged.
-- Payment(societyId, financialYear, status): the FY report sums and its list of years.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MembershipRole_roleId_idx" ON "MembershipRole"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_societyId_createdAt_id_idx" ON "Payment"("societyId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_societyId_financialYear_status_idx" ON "Payment"("societyId", "financialYear", "status");
