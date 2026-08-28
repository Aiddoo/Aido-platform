CREATE INDEX CONCURRENTLY "RetentionPushOutbox_status_availableAt_id_idx"
ON "RetentionPushOutbox"("status", "availableAt", "id");
