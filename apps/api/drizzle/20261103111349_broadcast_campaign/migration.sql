CREATE TABLE "BroadcastCampaign" (
	"actionType" "NotificationActionType",
	"actionUrl" text,
	"body" varchar(500) NOT NULL,
	"completedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"cursorUserId" text,
	"failureReason" varchar(500),
	"force" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY,
	"processedCount" integer DEFAULT 0 NOT NULL,
	"queuedCount" integer DEFAULT 0 NOT NULL,
	"requestId" uuid NOT NULL CONSTRAINT "BroadcastCampaign_requestId_key" UNIQUE,
	"startedAt" timestamp(3),
	"status" varchar(20) DEFAULT 'QUEUED' NOT NULL,
	"targetFilter" varchar(40) NOT NULL,
	"title" varchar(100) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "BroadcastCampaign_status_createdAt_idx" ON "BroadcastCampaign" ("status","createdAt");