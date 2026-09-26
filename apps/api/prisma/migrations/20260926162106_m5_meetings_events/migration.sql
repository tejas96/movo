-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeetingUpdateKind" AS ENUM ('RESCHEDULED', 'NOTE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RsvpResponse" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

-- CreateTable
CREATE TABLE "Meeting" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "audience" JSONB NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingUpdate" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "kind" "MeetingUpdateKind" NOT NULL,
    "body" TEXT,
    "previousStartsAt" TIMESTAMP(3),
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocietyEvent" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "audience" JSONB NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocietyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "eventId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "response" "RsvpResponse" NOT NULL,
    "guestsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("eventId","membershipId")
);

-- CreateTable
CREATE TABLE "ReminderSent" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_societyId_startsAt_idx" ON "Meeting"("societyId", "startsAt");

-- CreateIndex
CREATE INDEX "Meeting_status_startsAt_idx" ON "Meeting"("status", "startsAt");

-- CreateIndex
CREATE INDEX "MeetingUpdate_meetingId_createdAt_idx" ON "MeetingUpdate"("meetingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SocietyEvent_societyId_startsAt_idx" ON "SocietyEvent"("societyId", "startsAt");

-- CreateIndex
CREATE INDEX "SocietyEvent_status_startsAt_idx" ON "SocietyEvent"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSent_entityType_entityId_kind_key" ON "ReminderSent"("entityType", "entityId", "kind");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingUpdate" ADD CONSTRAINT "MeetingUpdate_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingUpdate" ADD CONSTRAINT "MeetingUpdate_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyEvent" ADD CONSTRAINT "SocietyEvent_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SocietyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSent" ADD CONSTRAINT "ReminderSent_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
