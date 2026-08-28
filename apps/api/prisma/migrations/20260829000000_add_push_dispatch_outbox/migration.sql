-- 일반 알림의 DB commit과 push 전달 예약을 원자적으로 묶습니다.
-- 신규 outbox가 없는 기존/retention PushDispatch는 이 relay의 대상이 아닙니다.
CREATE TYPE "PushDispatchOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED');
CREATE TYPE "PushDeliveryMode" AS ENUM ('SINGLE', 'BATCH');
CREATE TYPE "PushRateLimitPhase" AS ENUM ('GENERAL', 'ENGAGEMENT');

ALTER TABLE "PushDispatch"
  ADD COLUMN "processingJobId" VARCHAR(255),
  ADD COLUMN "processingJobAttempt" INTEGER,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rateLimitReservedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" VARCHAR(500);

CREATE TABLE "PushDispatchOutbox" (
  "dispatchId" INTEGER NOT NULL,
  "deliveryMode" "PushDeliveryMode" NOT NULL,
  "force" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" "PushDispatchOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "publishAttempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "lastError" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDispatchOutbox_pkey" PRIMARY KEY ("dispatchId")
);

CREATE INDEX "PushDispatchOutbox_status_availableAt_dispatchId_idx"
ON "PushDispatchOutbox"("status", "availableAt", "dispatchId");

CREATE INDEX "PushDispatchOutbox_status_lockedAt_idx"
ON "PushDispatchOutbox"("status", "lockedAt");

ALTER TABLE "PushDispatchOutbox"
ADD CONSTRAINT "PushDispatchOutbox_dispatchId_fkey"
FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushRateLimitReservation" (
  "dispatchId" INTEGER NOT NULL,
  "phase" "PushRateLimitPhase" NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" DATE,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushRateLimitReservation_pkey" PRIMARY KEY ("dispatchId", "phase")
);

CREATE INDEX "PushRateLimitReservation_phase_userId_reservedAt_idx"
ON "PushRateLimitReservation"("phase", "userId", "reservedAt");

CREATE INDEX "PushRateLimitReservation_phase_userId_localDate_reservedAt_idx"
ON "PushRateLimitReservation"("phase", "userId", "localDate", "reservedAt");

ALTER TABLE "PushRateLimitReservation"
ADD CONSTRAINT "PushRateLimitReservation_dispatchId_fkey"
FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
