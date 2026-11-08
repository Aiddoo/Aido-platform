ALTER TYPE "NotificationType" ADD VALUE 'PREMIUM_TRIAL_ENDING';--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "periodType" text;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "trialEndingNotifiedAt" timestamp(3) with time zone;--> statement-breakpoint
CREATE INDEX "Subscription_trial_ending_notice_idx" ON "Subscription" ("expiresAt","id") WHERE "periodType" = 'TRIAL' AND "trialEndingNotifiedAt" IS NULL;