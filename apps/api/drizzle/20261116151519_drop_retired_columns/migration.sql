-- 1.15.2에서 스키마만 뺀 칸을 지운다. 운영 확인(2026-11-16 15:13 UTC, 읽기 전용): 2단계 인증 0·secret 0, dataRetentionUntil 0.
-- 값이 생겼으면 guard가 멈춰 API는 바뀌지 않는다. DROP COLUMN은 User·Subscription을 잠깐 AccessExclusive로 잠근다.
SET LOCAL lock_timeout = '500ms';--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "User" WHERE "twoFactorEnabled" OR "twoFactorSecret" IS NOT NULL) THEN
		RAISE EXCEPTION 'User 2단계 인증 칸에 값이 있어 지우지 않는다';
	END IF;
	IF EXISTS (SELECT 1 FROM "Subscription" WHERE "dataRetentionUntil" IS NOT NULL) THEN
		RAISE EXCEPTION 'Subscription.dataRetentionUntil에 값이 있어 지우지 않는다';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN "twoFactorEnabled";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN "twoFactorSecret";--> statement-breakpoint
ALTER TABLE "Subscription" DROP COLUMN "dataRetentionUntil";
