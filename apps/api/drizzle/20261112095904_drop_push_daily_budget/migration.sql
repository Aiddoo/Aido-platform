-- 1.15.1·1.15.2 이미지 모두 쿼리하지 않는 테이블이다. 행이 하나라도 있으면 지우지 않고 migrate 전체를 되돌린다.
-- FK 때문에 "User"도 AccessExclusive로 잠근다. 0.5초 안에 못 잡으면 물러나 앱 요청이 밀리지 않고,
-- deadlock_timeout(1초)보다 짧아 교착이 생겨도 앱 트랜잭션이 아니라 이 migrate가 끊긴다.
SET LOCAL lock_timeout = '500ms';--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "PushDailyBudget") THEN
		RAISE EXCEPTION 'PushDailyBudget에 행 %개가 있어 지우지 않는다', (SELECT count(*) FROM "PushDailyBudget");
	END IF;
END $$;--> statement-breakpoint
DROP TABLE "PushDailyBudget";
