-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AmountRule" AS ENUM ('FLAT_RATE', 'PER_SQFT');

-- CreateEnum
CREATE TYPE "BillKind" AS ENUM ('MAINTENANCE', 'ADHOC');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DUE', 'PARTIALLY_PAID', 'OVERDUE', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "BillLineType" AS ENUM ('BASE', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentInstructionKind" AS ENUM ('UPI', 'BANK', 'OTHER');

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "BillingFrequency" NOT NULL,
    "amountRule" "AmountRule" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "generateDaysBefore" INTEGER NOT NULL,
    "lateFee" JSONB NOT NULL,
    "activeFrom" DATE NOT NULL,
    "activeTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlatChargeOverride" (
    "planId" UUID NOT NULL,
    "flatId" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,

    CONSTRAINT "FlatChargeOverride_pkey" PRIMARY KEY ("planId","flatId")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "flatId" UUID NOT NULL,
    "planId" UUID,
    "kind" "BillKind" NOT NULL,
    "title" TEXT NOT NULL,
    "periodKey" TEXT,
    "dueDate" DATE NOT NULL,
    "financialYear" TEXT NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'DUE',
    "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "waivedReason" TEXT,
    "waivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "type" "BillLineType" NOT NULL,
    "label" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "flatId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptNo" TEXT NOT NULL,
    "notes" TEXT,
    "financialYear" TEXT NOT NULL,
    "recordedByMembershipId" UUID NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "reversedReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "societyId" UUID NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("societyId","financialYear")
);

-- CreateTable
CREATE TABLE "PaymentInstruction" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "kind" "PaymentInstructionKind" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "payeeName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingPlan_societyId_isActive_idx" ON "BillingPlan"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "Bill_societyId_flatId_status_idx" ON "Bill"("societyId", "flatId", "status");

-- CreateIndex
CREATE INDEX "Bill_societyId_status_dueDate_idx" ON "Bill"("societyId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_planId_flatId_periodKey_key" ON "Bill"("planId", "flatId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillLine_billId_type_key" ON "BillLine"("billId", "type");

-- CreateIndex
CREATE INDEX "Payment_societyId_flatId_paidOn_idx" ON "Payment"("societyId", "flatId", "paidOn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_societyId_receiptNo_key" ON "Payment"("societyId", "receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_societyId_idempotencyKey_key" ON "Payment"("societyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_billId_idx" ON "PaymentAllocation"("billId");

-- CreateIndex
CREATE INDEX "PaymentInstruction_societyId_sortOrder_idx" ON "PaymentInstruction"("societyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlatChargeOverride" ADD CONSTRAINT "FlatChargeOverride_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlatChargeOverride" ADD CONSTRAINT "FlatChargeOverride_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlatChargeOverride" ADD CONSTRAINT "FlatChargeOverride_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstruction" ADD CONSTRAINT "PaymentInstruction_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
