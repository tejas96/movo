-- CreateEnum
CREATE TYPE "ParkingSlotType" AS ENUM ('TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'OTHER');

-- CreateEnum
CREATE TYPE "ParkingSlotStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'VISITOR');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'TRIAL', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EmergencyContactType" AS ENUM ('MEDICAL', 'FIRE', 'POLICE', 'SECURITY', 'LIFT', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertSource" AS ENUM ('USER', 'DEVICE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MEDICAL', 'FIRE', 'SECURITY', 'LIFT', 'GAS', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'FALSE_ALARM');

-- CreateTable
CREATE TABLE "ParkingSlot" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ParkingSlotType" NOT NULL DEFAULT 'FOUR_WHEELER',
    "level" TEXT,
    "status" "ParkingSlotStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingAllocation" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "flatId" UUID NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "notes" TEXT,
    "allocatedByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "flatId" UUID NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'FOUR_WHEELER',
    "makeModel" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCategory" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "description" TEXT,
    "availability" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'APPROVED',
    "adminNotes" TEXT,
    "addedByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" "EmergencyContactType" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublicNumber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "source" "AlertSource" NOT NULL DEFAULT 'USER',
    "type" "AlertType" NOT NULL,
    "raisedByMembershipId" UUID,
    "flatId" UUID,
    "message" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolvedByMembershipId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_societyId_code_key" ON "ParkingSlot"("societyId", "code");

-- CreateIndex
CREATE INDEX "ParkingAllocation_societyId_flatId_idx" ON "ParkingAllocation"("societyId", "flatId");

-- CreateIndex
CREATE INDEX "ParkingAllocation_slotId_idx" ON "ParkingAllocation"("slotId");

-- CreateIndex
CREATE INDEX "Vehicle_societyId_flatId_idx" ON "Vehicle"("societyId", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_societyId_registrationNo_key" ON "Vehicle"("societyId", "registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCategory_societyId_name_key" ON "VendorCategory"("societyId", "name");

-- CreateIndex
CREATE INDEX "Vendor_societyId_categoryId_status_idx" ON "Vendor"("societyId", "categoryId", "status");

-- CreateIndex
CREATE INDEX "EmergencyContact_societyId_sortOrder_idx" ON "EmergencyContact"("societyId", "sortOrder");

-- CreateIndex
CREATE INDEX "Alert_societyId_status_createdAt_idx" ON "Alert"("societyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_raisedByMembershipId_createdAt_idx" ON "Alert"("raisedByMembershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "ParkingSlot" ADD CONSTRAINT "ParkingSlot_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ParkingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCategory" ADD CONSTRAINT "VendorCategory_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VendorCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One active allocation per slot.
CREATE UNIQUE INDEX "ParkingAllocation_slot_active_key" ON "ParkingAllocation"("slotId") WHERE "toDate" IS NULL;
