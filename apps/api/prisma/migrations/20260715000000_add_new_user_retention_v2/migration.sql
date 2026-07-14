-- New-user-only retention experiment. No existing user is backfilled.
CREATE TYPE "RetentionExperimentVariant" AS ENUM ('CONTROL', 'TREATMENT');
CREATE TYPE "RetentionExperimentStageName" AS ENUM ('D0', 'D1', 'D3', 'D7');
CREATE TYPE "RetentionExperimentStageStatus" AS ENUM ('SCHEDULED', 'SKIPPED', 'OUTBOXED', 'EVALUATED');
CREATE TYPE "RetentionOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "RetentionExperimentAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" VARCHAR(100) NOT NULL,
    "variant" "RetentionExperimentVariant" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    CONSTRAINT "RetentionExperimentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionExperimentStage" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "stage" "RetentionExperimentStageName" NOT NULL,
    "status" "RetentionExperimentStageStatus" NOT NULL DEFAULT 'SCHEDULED',
    "skipReason" VARCHAR(100),
    "notificationId" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetentionExperimentStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionPushOutbox" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "dispatchId" INTEGER NOT NULL,
    "status" "RetentionOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetentionPushOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionExperimentResult" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "returnedWithinD7" BOOLEAN NOT NULL,
    "todoActionWithinD7" BOOLEAN NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetentionExperimentResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetentionExperimentAssignment_userId_experimentKey_key" ON "RetentionExperimentAssignment"("userId", "experimentKey");
CREATE INDEX "RetentionExperimentAssignment_experimentKey_variant_startedAt_idx" ON "RetentionExperimentAssignment"("experimentKey", "variant", "startedAt");
CREATE UNIQUE INDEX "RetentionExperimentStage_notificationId_key" ON "RetentionExperimentStage"("notificationId");
CREATE UNIQUE INDEX "RetentionExperimentStage_assignmentId_stage_key" ON "RetentionExperimentStage"("assignmentId", "stage");
CREATE INDEX "RetentionExperimentStage_status_stage_createdAt_idx" ON "RetentionExperimentStage"("status", "stage", "createdAt");
CREATE UNIQUE INDEX "RetentionPushOutbox_stageId_key" ON "RetentionPushOutbox"("stageId");
CREATE UNIQUE INDEX "RetentionPushOutbox_notificationId_key" ON "RetentionPushOutbox"("notificationId");
CREATE UNIQUE INDEX "RetentionPushOutbox_dispatchId_key" ON "RetentionPushOutbox"("dispatchId");
CREATE INDEX "RetentionPushOutbox_status_availableAt_idx" ON "RetentionPushOutbox"("status", "availableAt");
CREATE INDEX "RetentionPushOutbox_status_lockedAt_idx" ON "RetentionPushOutbox"("status", "lockedAt");
CREATE UNIQUE INDEX "RetentionExperimentResult_assignmentId_key" ON "RetentionExperimentResult"("assignmentId");
CREATE INDEX "RetentionExperimentResult_measuredAt_idx" ON "RetentionExperimentResult"("measuredAt");

ALTER TABLE "RetentionExperimentAssignment" ADD CONSTRAINT "RetentionExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionExperimentStage" ADD CONSTRAINT "RetentionExperimentStage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RetentionExperimentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionPushOutbox" ADD CONSTRAINT "RetentionPushOutbox_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "RetentionExperimentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionExperimentResult" ADD CONSTRAINT "RetentionExperimentResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RetentionExperimentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
