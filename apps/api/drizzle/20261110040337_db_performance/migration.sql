CREATE INDEX "TodoComment_replyToCommentId_idx" ON "TodoComment" ("replyToCommentId");--> statement-breakpoint
CREATE INDEX "PushDeliveryAttempt_pushTokenId_idx" ON "PushDeliveryAttempt" ("pushTokenId");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;--> statement-breakpoint
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC'); END $$;
