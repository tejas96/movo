-- Photo uploads beyond the Market: profile photo, society logo, expense bills, payment proofs,
-- task proofs. avatarUrl and logoUrl were never settable, so nothing is lost.

ALTER TYPE "FileKind" ADD VALUE 'AVATAR';
ALTER TYPE "FileKind" ADD VALUE 'SOCIETY_LOGO';
ALTER TYPE "FileKind" ADD VALUE 'EXPENSE_RECEIPT';
ALTER TYPE "FileKind" ADD VALUE 'PAYMENT_PROOF';
ALTER TYPE "FileKind" ADD VALUE 'TASK_PROOF';

-- AlterTable
ALTER TABLE "Society" DROP COLUMN "logoUrl",
ADD COLUMN     "logoFileId" UUID;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "expenseId" UUID,
ADD COLUMN     "paymentId" UUID,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taskId" UUID,
ALTER COLUMN "societyId" DROP NOT NULL,
ALTER COLUMN "ownerMembershipId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarFileId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Society_logoFileId_key" ON "Society"("logoFileId");

-- CreateIndex
CREATE INDEX "StoredFile_expenseId_idx" ON "StoredFile"("expenseId");

-- CreateIndex
CREATE INDEX "StoredFile_paymentId_idx" ON "StoredFile"("paymentId");

-- CreateIndex
CREATE INDEX "StoredFile_taskId_idx" ON "StoredFile"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarFileId_key" ON "User"("avatarFileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Society" ADD CONSTRAINT "Society_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

