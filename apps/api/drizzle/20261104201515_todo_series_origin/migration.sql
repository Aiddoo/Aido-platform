ALTER TABLE "TodoSeries" ADD COLUMN "originSeriesId" varchar(36);--> statement-breakpoint
-- 지금까지의 규칙은 모두 자기가 원본이다. 분할로 이어진 규칙은 앞으로 만들 때 원본을 물려받는다.
UPDATE "TodoSeries" SET "originSeriesId" = "id";--> statement-breakpoint
ALTER TABLE "TodoSeries" ALTER COLUMN "originSeriesId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "TodoSeries" DROP COLUMN "sortOrder";--> statement-breakpoint
CREATE INDEX "TodoSeries_userId_originSeriesId_idx" ON "TodoSeries" ("userId","originSeriesId");
