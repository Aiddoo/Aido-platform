ALTER TABLE "PremiumGrant" ADD COLUMN "durationMs" bigint;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "gracePeriodEndsAt" timestamp(3);