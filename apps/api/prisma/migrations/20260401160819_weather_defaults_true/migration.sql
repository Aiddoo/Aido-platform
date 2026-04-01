-- AlterTable
ALTER TABLE "UserPreference" ALTER COLUMN "weatherEveningEnabled" SET DEFAULT true,
ALTER COLUMN "weatherMorningEnabled" SET DEFAULT true;

-- Backfill: 기본값 그대로인 유저(직접 설정한 적 없는 유저)의 날씨 알림 활성화
-- 시간을 커스텀한 유저는 의도적으로 설정한 것이므로 변경하지 않음
UPDATE "UserPreference"
SET "weatherMorningEnabled" = true, "weatherEveningEnabled" = true
WHERE "weatherMorningEnabled" = false
  AND "weatherMorningHour" = 7
  AND "weatherMorningMinute" = 0
  AND "weatherEveningEnabled" = false
  AND "weatherEveningHour" = 18
  AND "weatherEveningMinute" = 0;

-- CreateIndex: findLatest 정렬 커버링 인덱스
CREATE INDEX "AiReport_userId_type_generatedAt_idx" ON "AiReport"("userId", "type", "generatedAt");

-- CreateIndex: findRecentResponded 이력 조회용 인덱스
CREATE INDEX "RecurringSuggestion_userId_updatedAt_idx" ON "RecurringSuggestion"("userId", "updatedAt");
