-- =============================================================================
-- AI Usage: 일간 → 월간 전환 일회성 데이터 이월 스크립트
-- =============================================================================
--
-- 목적:
--   이전 "일 5회" 제한에서 "월 5회" 제한으로 전환할 때, 현재 `aiUsageCount > 0`인
--   유저의 `aiUsageResetAt`을 이번 달(KST) 1일 자정으로 맞춰서 "오늘 쓴 횟수"가
--   "이번 달 쓴 횟수"로 그대로 이월되도록 한다.
--
-- 실행 방법:
--   배포 직후 단 1회 수동 실행. Prisma migration에는 포함하지 않는다
--   (스키마 변경이 아니라 데이터 교정이며, 롤백 시 스키마에 흔적이 남으면 안 됨).
--
--   psql "$DATABASE_URL" -f apps/api/scripts/ai-usage-monthly-transition.sql
--
-- 안전성:
--   - 스키마 변경 없음 (필드 타입/컬럼 동일)
--   - `aiUsageCount = 0`인 유저는 건드리지 않음 (리셋 시점 의미 없음)
--   - 롤백 불필요 (일간 코드로 돌아가도 `aiUsageResetAt`이 이번 달 1일이면
--     일간 코드의 isNewDay()가 true → `aiUsageCount`가 0으로 취급되어 안전)
-- =============================================================================

BEGIN;

UPDATE "User"
SET "aiUsageResetAt" = (
    (date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul'))) AT TIME ZONE 'Asia/Seoul'
)
WHERE "aiUsageCount" > 0;

COMMIT;
