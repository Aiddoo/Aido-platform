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
-- 기존 묶음은 이미 끝난 규칙으로 옮긴다. 새 회차를 만들지 않도록 nextOccurrenceDate는 NULL이다.
-- 옛 데이터에는 규칙이 없어 회차 행에서 유추한다.
-- 시간대: 없거나 잘못되면 앱 기본값(DEFAULT_DELIVERY_TIMEZONE)이고, 저장된 UTC는 진짜 UTC 사용자일 수 있어 그대로 둔다.
-- 제목·카테고리·시간: 한 회차만 고친 값이 규칙이 되지 않게 최빈값이고, 동률이면 가장 최근 회차 값이다.
-- 공개 범위: 비공개가 하나라도 있으면 비공개다. 새 회차가 더 넓게 공개되면 안 된다.
-- 요일: 옮긴 회차로 요일이 늘지 않게 고른다. 만든 뒤 손대지 않은 행이 있는 요일은 옛 앱이 만든 그대로다.
-- 나머지 요일은 시작~끝 사이의 그 요일 중 절반 넘게 행이 있을 때만 남긴다. 기간 때문에 건수가 다른 요일을 지키려고
-- 건수끼리 비교하지 않는다. 남는 요일이 없으면 패턴을 알 수 없어 규칙을 만들지 않는다. 그 묶음은 규칙 없는 묶음으로 동작한다.
INSERT INTO "TodoSeries" (
	"id", "userId", "categoryId", "title", "visibility", "scheduledLocalTime", "timezone",
	"repeatFrequency", "repeatInterval", "repeatWeekdays", "startDate", "repeatUntil",
	"checklistTemplate", "sortOrder", "nextOccurrenceDate", "generatedCount", "createdAt", "updatedAt"
)
WITH valid_zone AS MATERIALIZED (
	SELECT "name" FROM pg_timezone_names
),
member AS MATERIALIZED (
	SELECT
		t."recurrenceGroupId" AS "seriesId",
		t."id",
		t."userId",
		t."title",
		t."categoryId",
		t."visibility",
		t."startDate",
		t."sortOrder",
		t."createdAt",
		t."updatedAt",
		COALESCE(zone."name", 'Asia/Seoul') AS "zone",
		to_char(t."scheduledTime" AT TIME ZONE COALESCE(zone."name", 'Asia/Seoul'), 'HH24:MI') AS "localTime"
	FROM "Todo" AS t
	LEFT JOIN "UserPreference" AS preference ON preference."userId" = t."userId"
	LEFT JOIN valid_zone AS zone ON zone."name" = preference."timezone"
	WHERE t."recurrenceGroupId" IS NOT NULL
),
summary AS MATERIALIZED (
	SELECT
		"seriesId",
		min("id") AS "firstId",
		min("startDate") AS "firstDate",
		max("startDate") AS "lastDate",
		min("sortOrder") AS "minSortOrder",
		min("createdAt") AS "firstCreatedAt",
		min("updatedAt") AS "firstUpdatedAt",
		count(*)::integer AS "occurrenceCount",
		bool_or("visibility" = 'PRIVATE') AS "hasPrivate"
	FROM member
	GROUP BY "seriesId"
),
common_title AS (
	SELECT DISTINCT ON ("seriesId") "seriesId", "title"
	FROM (
		SELECT "seriesId", "title", count(*) AS "rows", max("startDate") AS "latest", max("id") AS "lastId"
		FROM member GROUP BY "seriesId", "title"
	) AS counted
	ORDER BY "seriesId", "rows" DESC, "latest" DESC, "lastId" DESC
),
common_category AS (
	SELECT DISTINCT ON ("seriesId") "seriesId", "categoryId"
	FROM (
		SELECT "seriesId", "categoryId", count(*) AS "rows", max("startDate") AS "latest", max("id") AS "lastId"
		FROM member GROUP BY "seriesId", "categoryId"
	) AS counted
	ORDER BY "seriesId", "rows" DESC, "latest" DESC, "lastId" DESC
),
common_time AS (
	SELECT DISTINCT ON ("seriesId") "seriesId", "localTime"
	FROM (
		SELECT "seriesId", "localTime", count(*) AS "rows", max("startDate") AS "latest", max("id") AS "lastId"
		FROM member GROUP BY "seriesId", "localTime"
	) AS counted
	ORDER BY "seriesId", "rows" DESC, "latest" DESC, "lastId" DESC
),
weekday_usage AS (
	SELECT
		m."seriesId",
		extract(isodow FROM m."startDate")::integer AS "weekday",
		count(*)::integer AS "rows",
		-- 한 번에 만든 행은 수정 시각이 몇 ms 안에 모인다. 전부 나중에 손댔으면 이 신호를 쓰지 않는다.
		bool_or(
			m."updatedAt" <= s."firstUpdatedAt" + interval '10 milliseconds'
			AND s."firstUpdatedAt" <= s."firstCreatedAt" + interval '1 minute'
		) AS "hasUntouchedRow",
		min(s."lastDate" - s."firstDate") AS "days",
		min(extract(isodow FROM s."firstDate")::integer) AS "firstWeekday"
	FROM member AS m
	JOIN summary AS s ON s."seriesId" = m."seriesId"
	GROUP BY m."seriesId", extract(isodow FROM m."startDate")
),
representative_weekday AS (
	SELECT
		"seriesId",
		array_agg((ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])["weekday"] ORDER BY "weekday") AS "weekdays"
	FROM weekday_usage
	WHERE "hasUntouchedRow"
		OR "rows" * 2 > ("days" - ("weekday" - "firstWeekday" + 7) % 7) / 7 + 1
	GROUP BY "seriesId"
)
SELECT
	summary."seriesId",
	first_row."userId",
	common_category."categoryId",
	common_title."title",
	(CASE WHEN summary."hasPrivate" THEN 'PRIVATE' ELSE 'PUBLIC' END)::"TodoVisibility",
	common_time."localTime",
	first_row."zone",
	(CASE WHEN cardinality(weekday."weekdays") = 7 THEN 'DAILY' ELSE 'WEEKLY' END)::"TodoRepeatFrequency",
	1,
	CASE WHEN cardinality(weekday."weekdays") = 7 THEN NULL ELSE weekday."weekdays" END,
	summary."firstDate",
	summary."lastDate",
	COALESCE(
		(
			SELECT jsonb_agg(jsonb_build_object('title', item."title") ORDER BY item."sortOrder", item."id")
			FROM "TodoItem" AS item
			WHERE item."todoId" = first_row."id"
		),
		'[]'::jsonb
	),
	summary."minSortOrder",
	NULL,
	summary."occurrenceCount",
	summary."firstCreatedAt",
	now()
FROM summary
JOIN member AS first_row ON first_row."id" = summary."firstId"
JOIN common_title ON common_title."seriesId" = summary."seriesId"
JOIN common_category ON common_category."seriesId" = summary."seriesId"
JOIN common_time ON common_time."seriesId" = summary."seriesId"
JOIN representative_weekday AS weekday ON weekday."seriesId" = summary."seriesId";--> statement-breakpoint
UPDATE "Todo" AS t SET "occurrenceDate" = t."startDate"
FROM "TodoSeries" AS series
WHERE t."recurrenceGroupId" = series."id";--> statement-breakpoint
CREATE UNIQUE INDEX "Todo_recurrenceGroupId_occurrenceDate_key" ON "Todo" ("recurrenceGroupId","occurrenceDate") WHERE "occurrenceDate" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "TodoSeries_nextOccurrenceDate_idx" ON "TodoSeries" ("nextOccurrenceDate") WHERE "nextOccurrenceDate" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "TodoSeries_userId_nextOccurrenceDate_idx" ON "TodoSeries" ("userId","nextOccurrenceDate");--> statement-breakpoint
CREATE INDEX "TodoSeries_categoryId_idx" ON "TodoSeries" ("categoryId");--> statement-breakpoint
ALTER TABLE "TodoSeries" ADD CONSTRAINT "TodoSeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TodoSeries" ADD CONSTRAINT "TodoSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;