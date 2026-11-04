CREATE TABLE "PlanApplication" (
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"idempotencyKey" varchar(128) NOT NULL,
	"memoId" integer,
	"requestHash" varchar(64) NOT NULL,
	"source" varchar(32) NOT NULL,
	"todoIds" integer[] NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "QuotaCharge" ADD COLUMN "requestHash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "PlanApplication_userId_idempotencyKey_key" ON "PlanApplication" ("userId","idempotencyKey");--> statement-breakpoint
CREATE INDEX "PlanApplication_createdAt_idx" ON "PlanApplication" ("createdAt");--> statement-breakpoint
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;