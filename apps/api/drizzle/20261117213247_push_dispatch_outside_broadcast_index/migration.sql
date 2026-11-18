-- 30일 발송 정리가 180일 남기는 관리자 캠페인 발송을 건너뛰고 지울 행만 읽게 한다. CREATE INDEX는 만드는 동안 PushDispatch
-- 쓰기를 막는다. 운영 행 수가 크면 배포 전에 같은 문장을 CONCURRENTLY로 손으로 만들고(indisvalid 확인), 여기 IF NOT EXISTS가
-- 건너뛴다. migrator는 한 트랜잭션이라 여기서 CONCURRENTLY를 쓸 수 없다.
CREATE INDEX IF NOT EXISTS "PushDispatch_status_scheduledAt_outside_broadcast_idx" ON "PushDispatch" ("status","scheduledAt") WHERE (("campaignKey" IS NULL) OR ("campaignKey" NOT LIKE 'admin-broadcast:%'));
