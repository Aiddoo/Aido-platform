DROP TABLE "RetentionPushOutbox";--> statement-breakpoint
ALTER TABLE "TodoComment" DROP COLUMN "depth";--> statement-breakpoint
ALTER TABLE "TodoComment" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "TodoComment" DROP COLUMN "rootId";--> statement-breakpoint
DROP TYPE "RetentionOutboxStatus";