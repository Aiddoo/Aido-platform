-- 기존 사용자 설정값은 유지하고 신규 설정의 기본값만 무료 정책(19:00)에 맞춘다.
ALTER TABLE "UserPreference"
ALTER COLUMN "eveningReminderHour" SET DEFAULT 19;
