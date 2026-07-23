/**
 * PushRateLimiterKeys 리터럴 고정 테스트
 *
 * 라이브 Redis 데이터 호환을 위해 키 문자열은 byte-identical해야 한다.
 * 리팩토링 중 우발적 키 드리프트를 회귀로 잡는다.
 */
import { PushRateLimiterKeys } from "./push-rate-limiter.keys";

describe("PushRateLimiterKeys — 키 문자열 고정", () => {
	it("general 키는 push-rate:{userId}", () => {
		expect(PushRateLimiterKeys.general("user_123")).toBe("push-rate:user_123");
	});

	it("engagement 키는 push-engagement:{userId}:{localDate}", () => {
		expect(PushRateLimiterKeys.engagement("user_123", "2026-03-09")).toBe(
			"push-engagement:user_123:2026-03-09",
		);
	});

	it("engagementPlaceholder 키는 push-engagement:unused:{index}", () => {
		expect(PushRateLimiterKeys.engagementPlaceholder(0)).toBe(
			"push-engagement:unused:0",
		);
		expect(PushRateLimiterKeys.engagementPlaceholder(3)).toBe(
			"push-engagement:unused:3",
		);
	});
});
