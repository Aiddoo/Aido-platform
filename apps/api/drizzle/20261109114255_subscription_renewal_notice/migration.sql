ALTER TYPE "NotificationType" ADD VALUE 'PREMIUM_RENEWAL_UPCOMING';--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "nextProductId" varchar(100);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "renewalNoticeExpiresAt" timestamp(3);