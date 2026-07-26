-- Growth summary scans the first instrumentation row and non-deleted signup
-- candidates by bounded ranges.
-- These are existing write-heavy tables. Keep each build CONCURRENTLY and keep
-- this migration outside BEGIN/COMMIT so deploys do not block app writes.
CREATE INDEX CONCURRENTLY "UserActivityDay_firstSeenAt_idx"
ON "UserActivityDay"("firstSeenAt");

CREATE INDEX CONCURRENTLY "User_deletedAt_createdAt_idx"
ON "User"("deletedAt", "createdAt");
