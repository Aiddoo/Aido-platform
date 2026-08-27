-- 댓글 알림 metadata에 복사된 senderId로 계정 purge 대상을 바로 찾습니다.
-- Prisma schema가 표현하지 못하는 partial expression index입니다.
CREATE INDEX CONCURRENTLY "Notification_comment_actor_cleanup_idx"
ON "Notification"(("metadata"->>'senderId'))
WHERE "metadata"->>'senderId' IS NOT NULL;
