-- AlterEnum: NotificationType에 AI 관련 타입 추가
ALTER TYPE "NotificationType" ADD VALUE 'MONTHLY_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'AI_SUGGESTION';

-- CreateEnum: ReportType
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum: SuggestionStatus
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateTable: AiReport
CREATE TABLE "AiReport" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "year" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "categoryBreakdown" JSONB NOT NULL,
    "dayPatterns" JSONB NOT NULL,
    "timePatterns" JSONB NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "aiTips" JSONB NOT NULL,
    "hasActivity" BOOLEAN NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RecurringSuggestion
CREATE TABLE "RecurringSuggestion" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "daysOfWeek" JSONB NOT NULL,
    "scheduledTime" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedTodos" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiReport_userId_type_year_period_key" ON "AiReport"("userId", "type", "year", "period");
CREATE INDEX "AiReport_userId_type_idx" ON "AiReport"("userId", "type");
CREATE INDEX "RecurringSuggestion_userId_status_idx" ON "RecurringSuggestion"("userId", "status");

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
