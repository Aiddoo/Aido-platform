ALTER TABLE "UserConsent" ADD COLUMN "marketingReconfirmedAt" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "UserPreference" ALTER COLUMN "nightPushEnabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "UserPreference" ALTER COLUMN "pushEnabled" SET DEFAULT true;