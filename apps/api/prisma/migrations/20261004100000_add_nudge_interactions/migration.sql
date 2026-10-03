CREATE TYPE "NudgeReplyKind" AS ENUM ('STARTING', 'THANKFUL', 'LATER');

ALTER TABLE "Nudge"
  ADD COLUMN "replyKind" "NudgeReplyKind",
  ADD COLUMN "repliedAt" TIMESTAMP(3),
  ADD COLUMN "replyUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "thankedAt" TIMESTAMP(3);
