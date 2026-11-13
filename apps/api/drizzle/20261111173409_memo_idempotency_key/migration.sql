ALTER TABLE "Memo" ADD COLUMN "idempotencyKey" varchar(128);--> statement-breakpoint
ALTER TABLE "Memo" ADD COLUMN "requestHash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "Memo_userId_idempotencyKey_key" ON "Memo" ("userId","idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);