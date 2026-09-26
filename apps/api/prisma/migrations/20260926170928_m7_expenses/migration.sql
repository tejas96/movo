-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncomeKind" AS ENUM ('DONATION', 'INTEREST', 'HALL_BOOKING', 'PENALTY', 'OTHER');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "incurredOn" DATE NOT NULL,
    "payeeName" TEXT NOT NULL,
    "description" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "status" "ExpenseStatus" NOT NULL,
    "financialYear" TEXT NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "decidedByMembershipId" UUID,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeEntry" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "kind" "IncomeKind" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "receivedOn" DATE NOT NULL,
    "description" TEXT,
    "financialYear" TEXT NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_societyId_name_key" ON "ExpenseCategory"("societyId", "name");

-- CreateIndex
CREATE INDEX "Expense_societyId_financialYear_status_idx" ON "Expense"("societyId", "financialYear", "status");

-- CreateIndex
CREATE INDEX "Expense_societyId_incurredOn_idx" ON "Expense"("societyId", "incurredOn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_societyId_idempotencyKey_key" ON "Expense"("societyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IncomeEntry_societyId_financialYear_idx" ON "IncomeEntry"("societyId", "financialYear");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
