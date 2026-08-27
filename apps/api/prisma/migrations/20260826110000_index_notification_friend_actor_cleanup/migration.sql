-- 계정 purge가 다른 수신자의 소셜 알림을 찾을 때 Notification 전체를 훑지 않게 합니다.
-- 기존 쓰기 트래픽을 막지 않도록 이 파일은 단일 CONCURRENTLY statement만 가집니다.
CREATE INDEX CONCURRENTLY "Notification_friend_actor_cleanup_idx"
ON "Notification"("friendId")
WHERE "friendId" IS NOT NULL;
