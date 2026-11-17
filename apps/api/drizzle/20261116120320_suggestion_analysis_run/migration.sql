-- ADD COLUMN이 AiReport·RecurringSuggestion을 AccessExclusive로, FK가 "User"를 잠근다. 0.5초 안에 못 잡으면
-- 물러나 앱 요청이 밀리지 않고, deadlock_timeout(1초)보다 짧아 교착이 생겨도 이 migrate가 끊긴다.
SET LOCAL lock_timeout = '500ms';--> statement-breakpoint
CREATE TABLE "SuggestionAnalysisRun" (
	"userId" text PRIMARY KEY,
	"status" varchar(16) NOT NULL,
	"localDate" date NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"outcome" varchar(32),
	"recentTodoCount" integer,
	"createdSuggestionCount" integer,
	"queuedAt" timestamp(3) NOT NULL,
	"startedAt" timestamp(3),
	"finishedAt" timestamp(3)
);
--> statement-breakpoint
ALTER TABLE "AiReport" ADD COLUMN "dailyCompletions" jsonb;--> statement-breakpoint
ALTER TABLE "RecurringSuggestion" ADD COLUMN "evidenceRecordedCount" integer;--> statement-breakpoint
ALTER TABLE "RecurringSuggestion" ADD COLUMN "evidenceCompletedCount" integer;--> statement-breakpoint
ALTER TABLE "RecurringSuggestion" ADD COLUMN "evidencePeriodDays" integer;--> statement-breakpoint
ALTER TABLE "SuggestionAnalysisRun" ADD CONSTRAINT "SuggestionAnalysisRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;