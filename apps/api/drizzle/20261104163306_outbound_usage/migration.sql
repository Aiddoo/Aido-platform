CREATE TABLE "OutboundUsage" (
	"meter" varchar(48),
	"periodKey" varchar(16),
	"subject" varchar(64),
	"updatedAt" timestamp(3) NOT NULL,
	"used" bigint NOT NULL,
	CONSTRAINT "OutboundUsage_pkey" PRIMARY KEY("meter","periodKey","subject")
);
--> statement-breakpoint
CREATE INDEX "OutboundUsage_updatedAt_idx" ON "OutboundUsage" ("updatedAt");