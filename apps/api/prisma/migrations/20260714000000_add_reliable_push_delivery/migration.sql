-- Separate explicit advertising-push consent from general marketing consent.
ALTER TABLE "UserConsent" ADD COLUMN "marketingPushAgreedAt" TIMESTAMP(3);

ALTER TABLE "PushToken"
  ADD COLUMN "payloadVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "appVersion" VARCHAR(30);

CREATE TYPE "NotificationActionType" AS ENUM ('DEEP_LINK', 'BROWSER', 'WEBVIEW', 'NONE');
CREATE TYPE "NotificationPurpose" AS ENUM ('TRANSACTIONAL', 'SCHEDULED_SERVICE', 'ENGAGEMENT');
CREATE TYPE "PushDispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED', 'HOLDOUT');
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'TICKET_ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN');

ALTER TABLE "Notification"
  ADD COLUMN "actionType" "NotificationActionType" NOT NULL DEFAULT 'DEEP_LINK',
  ADD COLUMN "actionUrl" VARCHAR(1000),
  ADD COLUMN "campaignKey" VARCHAR(100),
  ADD COLUMN "variantId" VARCHAR(100),
  ADD COLUMN "purpose" "NotificationPurpose" NOT NULL DEFAULT 'TRANSACTIONAL',
  ADD COLUMN "openedAt" TIMESTAMP(3);

-- Preserve the existing notification-center browser behavior for admin messages.
UPDATE "Notification"
SET "actionType" = 'BROWSER', "actionUrl" = "metadata"->>'externalUrl'
WHERE "metadata"->>'externalUrl' IS NOT NULL;

CREATE TABLE "PushDispatch" (
  "id" SERIAL NOT NULL,
  "notificationId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "NotificationPurpose" NOT NULL,
  "campaignKey" VARCHAR(100),
  "variantId" VARCHAR(100),
  "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
  "localDate" DATE,
  "status" "PushDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "skipReason" VARCHAR(100),
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDeliveryAttempt" (
  "id" SERIAL NOT NULL,
  "dispatchId" INTEGER NOT NULL,
  "pushTokenId" INTEGER NOT NULL,
  "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "expoTicketId" VARCHAR(100),
  "errorCode" VARCHAR(100),
  "errorMessage" VARCHAR(500),
  "receiptCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDailyBudget" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" DATE NOT NULL,
  "automatedCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDailyBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserActivityDay" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" DATE NOT NULL,
  "timezone" VARCHAR(50) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDispatch_notificationId_key" ON "PushDispatch"("notificationId");
CREATE INDEX "PushDispatch_status_scheduledAt_idx" ON "PushDispatch"("status", "scheduledAt");
CREATE INDEX "PushDispatch_userId_localDate_purpose_idx" ON "PushDispatch"("userId", "localDate", "purpose");
CREATE INDEX "PushDispatch_campaignKey_status_createdAt_idx" ON "PushDispatch"("campaignKey", "status", "createdAt");
CREATE UNIQUE INDEX "PushDeliveryAttempt_expoTicketId_key" ON "PushDeliveryAttempt"("expoTicketId");
CREATE UNIQUE INDEX "PushDeliveryAttempt_dispatchId_pushTokenId_key" ON "PushDeliveryAttempt"("dispatchId", "pushTokenId");
CREATE INDEX "PushDeliveryAttempt_status_createdAt_idx" ON "PushDeliveryAttempt"("status", "createdAt");
CREATE UNIQUE INDEX "PushDailyBudget_userId_localDate_key" ON "PushDailyBudget"("userId", "localDate");
CREATE UNIQUE INDEX "UserActivityDay_userId_localDate_key" ON "UserActivityDay"("userId", "localDate");
CREATE INDEX "UserActivityDay_localDate_idx" ON "UserActivityDay"("localDate");

ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDispatch" ADD CONSTRAINT "PushDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "PushDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDailyBudget" ADD CONSTRAINT "PushDailyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
