-- =============================================================================
-- TODO_REMINDER 중복 방지: Partial Unique Index
--
-- 같은 (todoId, type='TODO_REMINDER', metadata.stage) 조합이 DB 레벨에서 차단됨.
-- InMemoryScheduler + TodoReminderJob 간 Race Condition 최종 방어선.
-- =============================================================================

-- 기존 중복 데이터 정리 (최신 1건만 유지)
DELETE FROM "Notification" n
USING (
  SELECT "todoId", (metadata->>'stage') AS stage, MAX("id") AS keep_id
  FROM "Notification"
  WHERE "type" = 'TODO_REMINDER' AND "todoId" IS NOT NULL AND metadata->>'stage' IS NOT NULL
  GROUP BY "todoId", metadata->>'stage'
  HAVING COUNT(*) > 1
) dupes
WHERE n."todoId" = dupes."todoId"
  AND n."type" = 'TODO_REMINDER'
  AND n.metadata->>'stage' = dupes.stage
  AND n."id" <> dupes.keep_id;

-- Partial unique index 생성
CREATE UNIQUE INDEX "Notification_todo_reminder_dedup"
  ON "Notification" ("todoId", "type", (metadata->>'stage'))
  WHERE "type" = 'TODO_REMINDER' AND "todoId" IS NOT NULL;
