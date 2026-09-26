-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('LISTING_IMAGE');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('FOOD', 'PRODUCT', 'SERVICE', 'RESALE');

-- CreateEnum
CREATE TYPE "Diet" AS ENUM ('VEG', 'EGG', 'NON_VEG');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'PER_UNIT', 'NEGOTIABLE', 'FREE');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('PICKUP', 'DELIVERY', 'BOTH');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ListingVisibility" AS ENUM ('SOCIETY', 'NETWORK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "ownerMembershipId" UUID NOT NULL,
    "kind" "FileKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "sellerMembershipId" UUID NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceType" "PriceType" NOT NULL,
    "pricePaise" INTEGER,
    "unit" TEXT,
    "diet" "Diet",
    "quantityAvailable" INTEGER,
    "readyAt" TIMESTAMP(3),
    "orderBy" TIMESTAMP(3),
    "fulfilment" "Fulfilment" NOT NULL DEFAULT 'PICKUP',
    "condition" "ItemCondition",
    "visibility" "ListingVisibility" NOT NULL DEFAULT 'SOCIETY',
    "showPhoneAfterAccept" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiddenReason" TEXT,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingImage" (
    "listingId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("listingId","fileId")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerMembershipId" UUID NOT NULL,
    "sellerMembershipId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER,
    "fulfilment" "Fulfilment" NOT NULL,
    "note" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "buyerReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "senderMembershipId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingReview" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "authorMembershipId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingReport" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "reporterMembershipId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_societyId_attachedAt_idx" ON "StoredFile"("societyId", "attachedAt");

-- CreateIndex
CREATE INDEX "Listing_societyId_status_createdAt_idx" ON "Listing"("societyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Listing_sellerMembershipId_status_idx" ON "Listing"("sellerMembershipId", "status");

-- CreateIndex
CREATE INDEX "MarketOrder_buyerMembershipId_status_idx" ON "MarketOrder"("buyerMembershipId", "status");

-- CreateIndex
CREATE INDEX "MarketOrder_sellerMembershipId_status_idx" ON "MarketOrder"("sellerMembershipId", "status");

-- CreateIndex
CREATE INDEX "MarketOrder_listingId_status_idx" ON "MarketOrder"("listingId", "status");

-- CreateIndex
CREATE INDEX "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListingReview_orderId_key" ON "ListingReview"("orderId");

-- CreateIndex
CREATE INDEX "ListingReview_listingId_createdAt_idx" ON "ListingReview"("listingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ListingReport_societyId_status_idx" ON "ListingReport"("societyId", "status");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReview" ADD CONSTRAINT "ListingReview_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReview" ADD CONSTRAINT "ListingReview_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReview" ADD CONSTRAINT "ListingReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
