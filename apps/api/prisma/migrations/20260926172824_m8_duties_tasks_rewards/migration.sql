-- CreateEnum
CREATE TYPE "DutyPeriodUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "DutyParticipantKind" AS ENUM ('FLAT', 'MEMBER');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "DutyOnMiss" AS ENUM ('MARK_MISSED', 'CARRY_OVER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskEventKind" AS ENUM ('CREATED', 'ASSIGNED', 'VOLUNTEERED', 'WITHDRAWN', 'SUBMITTED', 'RETURNED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointsReason" AS ENUM ('TASK', 'DUTY', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Responsibility" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "participantKind" "DutyParticipantKind" NOT NULL,
    "periodUnit" "DutyPeriodUnit" NOT NULL,
    "periodLength" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL,
    "onMiss" "DutyOnMiss" NOT NULL,
    "points" INTEGER,
    "status" "DutyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityParticipant" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "responsibilityId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "flatId" UUID,
    "membershipId" UUID,

    CONSTRAINT "ResponsibilityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityAssignment" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "responsibilityId" UUID NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "flatId" UUID,
    "membershipId" UUID,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'UPCOMING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedByMembershipId" UUID,
    "overrideNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponsibilityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "dueOn" DATE,
    "assigneeMembershipId" UUID,
    "status" "TaskStatus" NOT NULL,
    "submissionNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedByMembershipId" UUID,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "kind" "TaskEventKind" NOT NULL,
    "note" TEXT,
    "byMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "PointsReason" NOT NULL,
    "label" TEXT NOT NULL,
    "refType" TEXT,
    "refId" UUID,
    "financialYear" TEXT NOT NULL,
    "createdByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Responsibility_societyId_status_idx" ON "Responsibility"("societyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityParticipant_responsibilityId_position_key" ON "ResponsibilityParticipant"("responsibilityId", "position");

-- CreateIndex
CREATE INDEX "ResponsibilityAssignment_societyId_status_periodEnd_idx" ON "ResponsibilityAssignment"("societyId", "status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsibilityAssignment_responsibilityId_periodIndex_key" ON "ResponsibilityAssignment"("responsibilityId", "periodIndex");

-- CreateIndex
CREATE INDEX "Task_societyId_status_idx" ON "Task"("societyId", "status");

-- CreateIndex
CREATE INDEX "Task_assigneeMembershipId_status_idx" ON "Task"("assigneeMembershipId", "status");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PointsLedger_societyId_financialYear_membershipId_idx" ON "PointsLedger"("societyId", "financialYear", "membershipId");

-- CreateIndex
CREATE INDEX "PointsLedger_membershipId_createdAt_idx" ON "PointsLedger"("membershipId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityParticipant" ADD CONSTRAINT "ResponsibilityParticipant_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityParticipant" ADD CONSTRAINT "ResponsibilityParticipant_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
