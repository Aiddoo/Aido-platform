-- 상수 기본값 칸 추가라 행을 다시 쓰지 않지만 푸시·설정 요청이 읽는 UserPreference를 잠깐 AccessExclusive로 잠근다.
-- 0.5초 안에 못 잡으면 물러나 앱 요청이 밀리지 않고, deadlock_timeout(1초)보다 짧아 교착이 생겨도 이 migrate가 끊긴다.
SET LOCAL lock_timeout = '500ms';--> statement-breakpoint
ALTER TABLE "UserPreference" ADD COLUMN "aiPushEnabled" boolean DEFAULT true NOT NULL;