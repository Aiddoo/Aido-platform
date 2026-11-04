CREATE TYPE "QuotaChargeStatus" AS ENUM('RESERVED', 'COMMITTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "QuotaMeter" AS ENUM('AI_PLAN', 'VOICE_NOTE');--> statement-breakpoint
CREATE TABLE "QuotaCharge" (
	"amount" smallint NOT NULL,
	"attempt" smallint NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"idempotencyKey" varchar(128),
	"meter" "QuotaMeter" NOT NULL,
	"periodKey" varchar(16) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"refundReason" varchar(64),
	"status" "QuotaChargeStatus" NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QuotaUsage" (
	"meter" "QuotaMeter",
	"periodKey" varchar(16),
	"updatedAt" timestamp(3) NOT NULL,
	"used" integer NOT NULL,
	"userId" text,
	CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY("userId","meter","periodKey")
);
--> statement-breakpoint
CREATE INDEX "QuotaCharge_userId_createdAt_idx" ON "QuotaCharge" ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "QuotaCharge_userId_meter_idempotencyKey_key" ON "QuotaCharge" ("userId","meter","idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "QuotaCharge" ADD CONSTRAINT "QuotaCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;