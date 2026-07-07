-- 푸시 알림 언어 설정 (기존 유저 전원 'ko' — 하위 호환 보장)
ALTER TABLE "UserPreference" ADD COLUMN "locale" VARCHAR(10) NOT NULL DEFAULT 'ko';
