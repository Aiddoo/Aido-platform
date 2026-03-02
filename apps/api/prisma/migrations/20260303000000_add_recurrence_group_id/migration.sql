-- AlterTable
ALTER TABLE "Todo" ADD COLUMN "recurrenceGroupId" VARCHAR(36);

-- CreateIndex
CREATE INDEX "Todo_recurrenceGroupId_idx" ON "Todo"("recurrenceGroupId");
