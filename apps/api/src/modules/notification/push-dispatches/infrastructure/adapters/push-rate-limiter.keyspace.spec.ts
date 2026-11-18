/**
 * PushRateLimiterKeys 리터럴 고정 테스트
 *
 * 라이브 Redis 데이터 호환을 위해 키 문자열은 byte-identical해야 한다.
 * 리팩토링 중 우발적 키 드리프트를 회귀로 잡는다.
 */
import { PushRateLimiterKeys } from "./push-rate-limiter.keyspace.js";

describe("PushRateLimiterKeys — 키 문자열 고정", () => {
  it("general 키는 push-rate:{userId}", () => {
    // When
    const key = PushRateLimiterKeys.general("user_123");

    // Then
    expect(key).toBe("push-rate:user_123");
  });

  it("engagement 키는 push-engagement:{userId}:{localDate}", () => {
    // When
    const key = PushRateLimiterKeys.engagement("user_123", "2026-03-09");

    // Then
    expect(key).toBe("push-engagement:user_123:2026-03-09");
  });

  it("engagementPlaceholder 키는 push-engagement:unused:{index}", () => {
    // When
    const firstPlaceholder = PushRateLimiterKeys.engagementPlaceholder(0);
    const fourthPlaceholder = PushRateLimiterKeys.engagementPlaceholder(3);

    // Then
    expect(firstPlaceholder).toBe("push-engagement:unused:0");
    expect(fourthPlaceholder).toBe("push-engagement:unused:3");
  });
});
