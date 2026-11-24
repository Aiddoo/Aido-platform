-- 새 테이블의 FK가 "User"·"Todo"를 잠근다. 0.5초 안에 못 잡으면 물러나 앱 요청이 밀리지 않고,
-- deadlock_timeout(1초)보다 짧아 교착이 생겨도 앱 트랜잭션이 아니라 이 migrate가 끊긴다.
SET LOCAL lock_timeout = '500ms';--> statement-breakpoint
CREATE TYPE "TodoImportItemStatus" AS ENUM('PENDING', 'CREATED', 'SKIPPED_DUPLICATE', 'SKIPPED_CAPACITY', 'SKIPPED_CATEGORY_MISSING', 'SKIPPED_INVALID');--> statement-breakpoint
CREATE TYPE "TodoImportSource" AS ENUM('DEVICE_CALENDAR');--> statement-breakpoint
CREATE TYPE "TodoImportStatus" AS ENUM('UPLOADING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDOING', 'UNDONE');--> statement-breakpoint
CREATE TYPE "TodoImportTimeMode" AS ENUM('TIME', 'DATE_ONLY');--> statement-breakpoint
CREATE TABLE "TodoImport" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"source" "TodoImportSource" NOT NULL,
	"status" "TodoImportStatus" NOT NULL,
	"idempotencyKey" text NOT NULL,
	"requestHash" varchar(64) NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"timeMode" "TodoImportTimeMode" NOT NULL,
	"visibility" "TodoVisibility" NOT NULL,
	"targets" jsonb NOT NULL,
	"collections" jsonb NOT NULL,
	"expectedItemCount" integer NOT NULL,
	"receivedItemCount" integer DEFAULT 0 NOT NULL,
	"processedItemCount" integer DEFAULT 0 NOT NULL,
	"createdCount" integer DEFAULT 0 NOT NULL,
	"skippedDuplicateCount" integer DEFAULT 0 NOT NULL,
	"skippedCapacityCount" integer DEFAULT 0 NOT NULL,
	"skippedCategoryMissingCount" integer DEFAULT 0 NOT NULL,
	"skippedInvalidCount" integer DEFAULT 0 NOT NULL,
	"undoneCount" integer DEFAULT 0 NOT NULL,
	"keptCompletedCount" integer DEFAULT 0 NOT NULL,
	"firstDate" date,
	"round" integer DEFAULT 0 NOT NULL,
	"recoveryCount" integer DEFAULT 0 NOT NULL,
	"failureReason" varchar(50),
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"committedAt" timestamp(3),
	"completedAt" timestamp(3),
	"undoRequestedAt" timestamp(3),
	CONSTRAINT "TodoImport_userId_idempotencyKey_key" UNIQUE("userId","idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "TodoImportItem" (
	"importId" text,
	"sourceKey" varchar(64),
	"collectionKey" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"localTime" varchar(5),
	"status" "TodoImportItemStatus" DEFAULT 'PENDING'::"TodoImportItemStatus" NOT NULL,
	CONSTRAINT "TodoImportItem_pkey" PRIMARY KEY("importId","sourceKey")
);
--> statement-breakpoint
CREATE TABLE "TodoImportLink" (
	"todoId" integer PRIMARY KEY,
	"userId" text NOT NULL,
	"sourceKey" varchar(64) NOT NULL,
	"importId" text,
	"createdAt" timestamp(3) NOT NULL,
	CONSTRAINT "TodoImportLink_userId_sourceKey_key" UNIQUE("userId","sourceKey")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "TodoImport_userId_active_key" ON "TodoImport" ("userId") WHERE "status" IN ('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING');--> statement-breakpoint
CREATE INDEX "TodoImport_status_updatedAt_idx" ON "TodoImport" ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "TodoImportItem_importId_pending_idx" ON "TodoImportItem" ("importId","startDate","localTime","sourceKey") WHERE "status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "TodoImportLink_importId_todoId_idx" ON "TodoImportLink" ("importId","todoId");--> statement-breakpoint
ALTER TABLE "TodoImport" ADD CONSTRAINT "TodoImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoImportItem" ADD CONSTRAINT "TodoImportItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TodoImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoImportLink" ADD CONSTRAINT "TodoImportLink_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoImportLink" ADD CONSTRAINT "TodoImportLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoImportLink" ADD CONSTRAINT "TodoImportLink_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TodoImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;