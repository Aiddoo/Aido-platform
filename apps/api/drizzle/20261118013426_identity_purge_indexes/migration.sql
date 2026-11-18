-- 만료 기록 정리(identity.expired-record-purge.v1)의 마지막 묶음이 두 테이블을 끝까지 순차로 읽지 않게 한다.
-- CREATE INDEX는 만드는 동안 그 테이블 쓰기를 막는다. 운영 행 수가 크면 배포 전에 같은 문장을 CONCURRENTLY로 손으로 만들고
-- (indisvalid 확인), 여기 IF NOT EXISTS가 건너뛴다. migrator는 한 트랜잭션이라 여기서 CONCURRENTLY를 쓸 수 없다.
CREATE INDEX IF NOT EXISTS "SecurityLog_createdAt_idx" ON "SecurityLog" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Session_revokedAt_idx" ON "Session" ("revokedAt") WHERE ("revokedAt" IS NOT NULL);
