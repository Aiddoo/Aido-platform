CREATE TABLE "ScheduledSweepCursor" (
	"key" text PRIMARY KEY,
	"lastCompletedAt" timestamp(3) with time zone NOT NULL
);
