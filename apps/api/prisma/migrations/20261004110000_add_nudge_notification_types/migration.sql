ALTER TYPE "NotificationType" ADD VALUE 'NUDGE_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'NUDGE_THANKED';

CREATE UNIQUE INDEX "Nudge_thanked_sender_per_todo"
  ON "Nudge" ("todoId", "senderId") WHERE "thankedAt" IS NOT NULL;
