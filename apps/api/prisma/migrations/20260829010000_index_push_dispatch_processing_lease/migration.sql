-- 중단된 delivery lease 복구가 PROCESSING 행만 짧게 스캔하도록 합니다.
-- 기존 쓰기 트래픽을 막지 않도록 이 파일은 단일 CONCURRENTLY statement만 가집니다.
CREATE INDEX CONCURRENTLY "PushDispatch_processing_lease_idx"
ON "PushDispatch"("processingStartedAt")
WHERE "status" = 'PROCESSING';
