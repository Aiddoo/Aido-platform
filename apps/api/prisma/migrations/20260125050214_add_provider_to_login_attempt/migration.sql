-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "provider" "AccountProvider";

-- CreateIndex
CREATE INDEX "LoginAttempt_provider_createdAt_idx" ON "LoginAttempt"("provider", "createdAt");
