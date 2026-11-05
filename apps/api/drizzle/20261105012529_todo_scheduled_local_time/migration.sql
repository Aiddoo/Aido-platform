-- 행이 많으면 배포 전에 칸과 값을 나눠 채울 수 있게 다시 돌아도 되는 문장으로 쓴다(DEPLOYMENT.md).
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "scheduledLocalTime" varchar(5);--> statement-breakpoint
-- 순간은 그대로 두고 벽시계만 채운다. 시간대: 없거나 잘못되면 앱 기본값(DEFAULT_DELIVERY_TIMEZONE)이고, 저장된 UTC는 진짜 UTC 사용자일 수 있어 그대로 둔다.
-- updatedAt은 건드리지 않는다. 사용자가 고친 시각이 아니다.
UPDATE "Todo" AS t
SET "scheduledLocalTime" = to_char(t."scheduledTime" AT TIME ZONE zone."name", 'HH24:MI')
FROM (
	SELECT u."id" AS "userId", COALESCE(valid_zone."name", 'Asia/Seoul') AS "name"
	FROM "User" AS u
	LEFT JOIN "UserPreference" AS preference ON preference."userId" = u."id"
	LEFT JOIN (SELECT "name" FROM pg_timezone_names) AS valid_zone ON valid_zone."name" = preference."timezone"
) AS zone
WHERE zone."userId" = t."userId" AND t."scheduledTime" IS NOT NULL AND t."scheduledLocalTime" IS NULL;
