-- 리텐션 발송이 공용 push-delivery outbox로 옮겨진다. 아직 보내지 않은 리텐션 dispatch를 공용 outbox에 올리고,
-- 이전 배포의 리텐션 worker가 같은 dispatch를 다시 잡지 못하도록 리텐션 outbox를 종결한다.
UPDATE "PushDispatch" AS dispatch
SET "status" = 'PENDING'::"PushDispatchStatus",
    "processingJobId" = NULL,
    "processingJobAttempt" = NULL,
    "processingStartedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "RetentionPushOutbox" AS retention_outbox
WHERE retention_outbox."dispatchId" = dispatch."id"
  AND retention_outbox."status" IN ('PENDING', 'PROCESSING', 'PUBLISHED')
  AND dispatch."status" IN ('PENDING', 'PROCESSING');
--> statement-breakpoint
INSERT INTO "PushDispatchOutbox" ("dispatchId", "deliveryMode", "status", "availableAt", "updatedAt")
SELECT retention_outbox."dispatchId", 'SINGLE', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "RetentionPushOutbox" AS retention_outbox
JOIN "PushDispatch" AS dispatch ON dispatch."id" = retention_outbox."dispatchId"
WHERE retention_outbox."status" IN ('PENDING', 'PROCESSING', 'PUBLISHED')
  AND dispatch."status" = 'PENDING'
ON CONFLICT ("dispatchId") DO NOTHING;
--> statement-breakpoint
UPDATE "RetentionPushOutbox"
SET "status" = 'FAILED'::"RetentionOutboxStatus",
    "lockedAt" = NULL,
    "lastError" = 'MOVED_TO_PUSH_DISPATCH_OUTBOX',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('PENDING', 'PROCESSING', 'PUBLISHED')
  AND EXISTS (
    SELECT 1
    FROM "PushDispatchOutbox" AS shared_outbox
    WHERE shared_outbox."dispatchId" = "RetentionPushOutbox"."dispatchId"
  );
