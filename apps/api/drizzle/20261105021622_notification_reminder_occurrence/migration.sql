ALTER TABLE "Notification" ADD COLUMN "reminderOccurrenceKey" varchar(16);--> statement-breakpoint
-- 지금 일정과 같은 날짜로 이미 울린 단계만 그 회차로 적는다. 그래야 배포 뒤 시간대 재계산이 그 단계를 다시 울리지 않는다.
-- 다른 날짜로 울린 행과 휴면 안내는 비워 둔다. 새 회차를 막지 않고, 비운 값끼리는 옛 인덱스처럼 할 일 + 단계로 막힌다.
-- 그제 이전 할 일은 지난 단계를 다시 예약하지 않으므로 고치지 않는다(서쪽 끝 시간대도 그제까지만 어제다).
-- 알림의 todoDate는 1.13.0부터 쌓였다. 그 전 행은 벌써 지난 할 일이라 건너뛴다.
UPDATE "Notification" AS n
SET "reminderOccurrenceKey" = to_char(t."startDate", 'YYYY-MM-DD') || 'T' || t."scheduledLocalTime"
FROM "Todo" AS t
WHERE n."todoId" = t."id"
	AND n."type" = 'TODO_REMINDER'
	AND n."metadata" ->> 'stage' IN ('60min', '10min', 'immediate')
	AND n."metadata" ->> 'todoDate' = to_char(t."startDate", 'YYYY-MM-DD')
	AND t."scheduledLocalTime" IS NOT NULL
	AND t."startDate" >= CURRENT_DATE - 2;--> statement-breakpoint
DROP INDEX "Notification_todo_reminder_dedup";--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_todo_reminder_occurrence_dedup" ON "Notification" ("todoId","type",(metadata ->> 'stage'::text),(COALESCE("reminderOccurrenceKey", ''::character varying))) WHERE ((type = 'TODO_REMINDER'::"NotificationType") AND ("todoId" IS NOT NULL));
