-- Growth summary scans the first instrumentation row and non-deleted signup
-- candidates by bounded ranges.
CREATE INDEX "UserActivityDay_firstSeenAt_idx"
ON "UserActivityDay"("firstSeenAt");

CREATE INDEX "User_deletedAt_createdAt_idx"
ON "User"("deletedAt", "createdAt");
