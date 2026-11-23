import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { toIsoString } from "#api/shared/domain/time/instant";

import { USER_PROFILE_CACHE_TTL_MS, userProfileTtlMs } from "./user-profile-cache.keyspace.js";

const AT = Temporal.Instant.from("2026-11-03T00:00:00.000Z");
const SECOND_MS = 1000;

function isoAfter(milliseconds: number): string {
  return toIsoString(AT.add({ milliseconds }));
}

describe("userProfileTtlMs — 프로필 캐시 TTL", () => {
  it("프리미엄 경계가 없거나 기본 TTL보다 멀면 기본 TTL이다", () => {
    // When
    const results = [
      userProfileTtlMs(null, AT),
      userProfileTtlMs({ subscriptionExpiresAt: null }, AT),
      userProfileTtlMs({ subscriptionExpiresAt: isoAfter(24 * 60 * 60 * SECOND_MS) }, AT),
    ];

    // Then
    expect(results).toEqual(Array(3).fill(USER_PROFILE_CACHE_TTL_MS));
  });

  it("보상 기간이 1초 뒤 끝나면 1초 뒤 캐시가 만료된다", () => {
    // When
    const ttl = userProfileTtlMs(
      { subscriptionExpiresAt: isoAfter(SECOND_MS), premiumPeriodEndsAt: isoAfter(SECOND_MS) },
      AT,
    );

    // Then
    expect(ttl).toBe(SECOND_MS);
  });

  it("만료 시각이 지났어도 자동 갱신 유예가 1초 남았으면 유예 끝에 캐시가 만료된다", () => {
    // When
    const ttl = userProfileTtlMs(
      { subscriptionExpiresAt: isoAfter(SECOND_MS - STORE_RENEWAL_GRACE_MS) },
      AT,
    );

    // Then
    expect(ttl).toBe(SECOND_MS);
  });

  it("결제 유예 중이면 유예 끝(premiumPeriodEndsAt)에 캐시가 만료된다", () => {
    // Given
    // 만료 10일 뒤, 유예는 1초 남았다

    const graceEndsAt = isoAfter(SECOND_MS);

    // When
    const ttl = userProfileTtlMs(
      {
        subscriptionExpiresAt: graceEndsAt,
        premiumEndsAt: graceEndsAt,
        premiumPeriodEndsAt: graceEndsAt,
      },
      AT,
    );

    // Then
    expect(ttl).toBe(SECOND_MS);
  });

  it("지금이 ms보다 정밀해도 Redis PX에 넣을 정수 ms다", () => {
    // Given
    const atWithNanoseconds = Temporal.Instant.from("2026-11-03T00:00:00.000123456Z");

    // When
    const ttl = userProfileTtlMs({ subscriptionExpiresAt: isoAfter(SECOND_MS) }, atWithNanoseconds);

    // Then
    expect(ttl).toBe(SECOND_MS);
  });
});
