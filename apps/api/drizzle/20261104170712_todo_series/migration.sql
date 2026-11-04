CREATE TYPE "TodoRepeatFrequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TABLE "TodoSeries" (
	"categoryId" integer NOT NULL,
	"checklistTemplate" jsonb DEFAULT '[]' NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"generatedCount" integer DEFAULT 0 NOT NULL,
	"id" varchar(36) PRIMARY KEY,
	"nextOccurrenceDate" date,
	"repeatCount" smallint,
	"repeatFrequency" "TodoRepeatFrequency" NOT NULL,
	"repeatInterval" smallint DEFAULT 1 NOT NULL,
	"repeatMonthDay" smallint,
	"repeatUntil" date,
	"repeatWeekdays" text[],
	"scheduledLocalTime" varchar(5),
	"sortOrder" integer NOT NULL,
	"startDate" date NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	"visibility" "TodoVisibility" DEFAULT 'PUBLIC'::"TodoVisibility" NOT NULL,
	CONSTRAINT "TodoSeries_repeatInterval_check" CHECK ("repeatInterval" IN (1, 2)),
	CONSTRAINT "TodoSeries_repeatWeekdays_check" CHECK (("repeatFrequency" = 'WEEKLY') = ("repeatWeekdays" IS NOT NULL AND cardinality("repeatWeekdays") > 0) AND ("repeatWeekdays" IS NULL OR "repeatWeekdays" <@ ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN']::text[])),
	CONSTRAINT "TodoSeries_repeatMonthDay_check" CHECK (("repeatFrequency" = 'MONTHLY') = ("repeatMonthDay" IS NOT NULL) AND ("repeatMonthDay" IS NULL OR "repeatMonthDay" BETWEEN 1 AND 31)),
	CONSTRAINT "TodoSeries_repeatCount_check" CHECK ("repeatCount" IS NULL OR "repeatCount" BETWEEN 1 AND 365),
	CONSTRAINT "TodoSeries_repeatEnd_check" CHECK ("repeatUntil" IS NULL OR "repeatCount" IS NULL)
);
--> statement-breakpoint
DROP INDEX "Todo_recurrenceGroupId_idx";--> statement-breakpoint
ALTER TABLE "Todo" ADD COLUMN "occurrenceDate" date;--> statement-breakpoint
-- 묶음 안에 같은 날짜가 둘 이상이면 가장 작은 id만 남기고 나머지는 묶음에서 뺀다(유니크 인덱스 전제).
UPDATE "Todo" AS t SET "recurrenceGroupId" = NULL
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "recurrenceGroupId", "startDate" ORDER BY "id") AS "rank"
	FROM "Todo"
	WHERE "recurrenceGroupId" IS NOT NULL
) AS duplicate
WHERE t."id" = duplicate."id" AND duplicate."rank" > 1;--> statement-breakpoint
UPDATE "Todo" SET "occurrenceDate" = "startDate" WHERE "recurrenceGroupId" IS NOT NULL;--> statement-breakpoint
-- 기존 묶음은 이미 끝난 규칙으로 옮긴다. 새 회차를 만들지 않도록 nextOccurrenceDate는 NULL이다.
INSERT INTO "TodoSeries" (
	"id", "userId", "categoryId", "title", "visibility", "scheduledLocalTime", "timezone",
	"repeatFrequency", "repeatInterval", "repeatWeekdays", "startDate", "repeatUntil",
	"checklistTemplate", "sortOrder", "nextOccurrenceDate", "generatedCount", "createdAt", "updatedAt"
)
SELECT
	grouped."seriesId",
	first_row."userId",
	first_row."categoryId",
	first_row."title",
	first_row."visibility",
	CASE WHEN first_row."scheduledTime" IS NULL THEN NULL
		ELSE to_char(first_row."scheduledTime" AT TIME ZONE zone."name", 'HH24:MI') END,
	zone."name",
	(CASE WHEN cardinality(grouped."weekdays") = 7 THEN 'DAILY' ELSE 'WEEKLY' END)::"TodoRepeatFrequency",
	1,
	CASE WHEN cardinality(grouped."weekdays") = 7 THEN NULL ELSE grouped."weekdays" END,
	grouped."firstDate",
	grouped."lastDate",
	COALESCE(
		(
			SELECT jsonb_agg(jsonb_build_object('title', item."title") ORDER BY item."sortOrder", item."id")
			FROM "TodoItem" AS item
			WHERE item."todoId" = first_row."id"
		),
		'[]'::jsonb
	),
	grouped."minSortOrder",
	NULL,
	grouped."occurrenceCount",
	grouped."firstCreatedAt",
	now()
FROM (
	SELECT
		"recurrenceGroupId" AS "seriesId",
		min("id") AS "firstId",
		min("startDate") AS "firstDate",
		max("startDate") AS "lastDate",
		min("sortOrder") AS "minSortOrder",
		min("createdAt") AS "firstCreatedAt",
		count(*)::integer AS "occurrenceCount",
		ARRAY(
			SELECT (ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])[weekday]
			FROM unnest(array_agg(DISTINCT extract(isodow FROM "startDate")::integer)) AS weekday
			ORDER BY weekday
		) AS "weekdays"
	FROM "Todo"
	WHERE "recurrenceGroupId" IS NOT NULL
	GROUP BY "recurrenceGroupId"
) AS grouped
JOIN "Todo" AS first_row ON first_row."id" = grouped."firstId"
LEFT JOIN "UserPreference" AS preference ON preference."userId" = first_row."userId"
-- 잘못 저장된 옛 시간대가 있어도 이관이 멈추지 않도록 UTC로 격리한다.
LEFT JOIN LATERAL (
	SELECT COALESCE(
		(SELECT tz."name" FROM pg_timezone_names AS tz WHERE tz."name" = preference."timezone"),
		'UTC'
	) AS "name"
) AS zone ON true;--> statement-breakpoint
CREATE UNIQUE INDEX "Todo_recurrenceGroupId_occurrenceDate_key" ON "Todo" ("recurrenceGroupId","occurrenceDate") WHERE "occurrenceDate" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "TodoSeries_nextOccurrenceDate_idx" ON "TodoSeries" ("nextOccurrenceDate") WHERE "nextOccurrenceDate" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "TodoSeries_userId_nextOccurrenceDate_idx" ON "TodoSeries" ("userId","nextOccurrenceDate");--> statement-breakpoint
CREATE INDEX "TodoSeries_categoryId_idx" ON "TodoSeries" ("categoryId");--> statement-breakpoint
ALTER TABLE "TodoSeries" ADD CONSTRAINT "TodoSeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoSeries" ADD CONSTRAINT "TodoSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;