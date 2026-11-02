CREATE TYPE "SubscriptionEnvironment" AS ENUM('SANDBOX', 'PRODUCTION');--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "environment" "SubscriptionEnvironment";--> statement-breakpoint
ALTER TABLE "SubscriptionEventReceipt" ADD COLUMN "environment" "SubscriptionEnvironment";