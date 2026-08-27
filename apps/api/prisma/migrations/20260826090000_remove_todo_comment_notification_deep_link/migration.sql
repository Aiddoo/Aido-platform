-- 댓글 알림은 한 레코드를 여러 앱 버전이 함께 읽습니다.
-- v1.8은 TODO_SHARED 기본 목적지(/feed)를 사용하고, 최신 앱은 metadata의 commentId를
-- 해석하도록 서버가 특정 모바일 route를 actionUrl에 고정하지 않습니다.
-- migration이 먼저 실행되고 구 API가 잠시 계속 쓰는 배포 순서에서도 잘못된 push를 보내지
-- 않아야 합니다. 값을 고치는 trigger는 구 API가 메모리에 가진 URL로 push를 보낼 수 있으므로,
-- 알림 body에 복사된 보낸 사람의 이름을 계정 purge 시 찾을 수 있어야 합니다.
-- NOT VALID는 기존 행은 나중에 보정하면서도 새 구 API write는 즉시 거부합니다.
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_todo_comment_sender_check"
CHECK (
  "metadata"->>'commentId' IS NULL
  OR COALESCE((
    JSONB_TYPEOF("metadata"->'senderId') = 'string'
    AND LENGTH("metadata"->>'senderId') > 0
  ), FALSE)
)
NOT VALID;

-- COMMENT/REPLY는 생성된 댓글의 작성자로 기존 actor를 복구할 수 있습니다.
UPDATE "Notification" AS notification
SET "metadata" = JSONB_SET(
  notification."metadata",
  '{senderId}',
  TO_JSONB(comment."authorId"),
  TRUE
)
FROM "TodoComment" AS comment
WHERE notification."metadata"->>'commentId' = comment."id"
  AND notification."metadata"->>'activityKind' IN ('COMMENT', 'REPLY')
  AND notification."metadata"->>'senderId' IS NULL;

-- 기존 LIKE의 commentId는 좋아요를 받은 댓글이지 누른 사람이 아니라 actor를
-- 안전하게 복구할 수 없습니다. 작성자가 사라진 기존 알림과 함께 제거합니다.
DELETE FROM "Notification"
WHERE "metadata"->>'commentId' IS NOT NULL
  AND "metadata"->>'senderId' IS NULL;

-- sender invariant가 구 writer를 이미 막은 뒤 route 제약을 공개합니다.
-- 댓글 쓰기는 commit 뒤 best-effort 알림이라 해당 배포 구간에도 본 작업은 보존됩니다.
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_todo_comment_action_url_check"
CHECK (
  "type" <> 'TODO_SHARED'
  OR "actionType" <> 'DEEP_LINK'
  OR "metadata"->>'commentId' IS NULL
  OR "actionUrl" IS NULL
)
NOT VALID;

UPDATE "Notification"
SET "actionUrl" = NULL
WHERE "type" = 'TODO_SHARED'
  AND "actionType" = 'DEEP_LINK'
  AND "actionUrl" IS NOT NULL
  AND "metadata"->>'commentId' IS NOT NULL;

ALTER TABLE "Notification"
VALIDATE CONSTRAINT "Notification_todo_comment_action_url_check";

ALTER TABLE "Notification"
VALIDATE CONSTRAINT "Notification_todo_comment_sender_check";
