import { storeRenewalGraceEndsAt } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const USER_PROFILE_CACHE_TTL_MS = 5 * 60_000;
// 출시 서버가 쓰던 keyspace 이름(auth)을 그대로 써야 배포 중 두 버전이 같은 캐시를 지운다
export const UserProfileCacheKey = {
  userProfile: (userId: string) => cacheKey("auth", "user-profile", userId),
  userProfileGeneration: (userId: string) => cacheKey("auth", "user-profile-generation", userId),
} as const;

/**
 * 프로필의 프리미엄 표시 필드가 바뀌는 시각. 자동 갱신 구독은 만료 뒤 유예가 끝날 때도 바뀐다.
 * 스토어 결제 유예의 끝은 premiumPeriodEndsAt(storePeriodEndsAt)과 projection 만료 시각에 들어 있다.
 */
interface UserProfilePremiumBoundaries {
  readonly subscriptionExpiresAt: string | null;
  readonly premiumEndsAt?: string | null;
  readonly premiumPeriodEndsAt?: string | null;
}

/**
 * 프리미엄 경계를 넘긴 프로필을 캐시에서 주지 않도록 TTL을 다음 경계까지로 줄인다.
 * 쓰기 없이 시간만 지나 바뀌는 상태라 웹훅·정리 작업의 무효화만으로는 알 수 없다.
 */
export function userProfileTtlMs(
  profile: UserProfilePremiumBoundaries | null,
  at: Temporal.Instant,
): number {
  if (profile == null) {
    return USER_PROFILE_CACHE_TTL_MS;
  }
  const untilBoundaries = [
    profile.subscriptionExpiresAt,
    profile.premiumEndsAt,
    profile.premiumPeriodEndsAt,
  ]
    .flatMap((iso) => (iso == null ? [] : [Temporal.Instant.from(iso)]))
    .flatMap((endsAt) => [endsAt, storeRenewalGraceEndsAt(endsAt)])
    // Redis PX는 정수 ms라 ns 정밀도를 올림한다. 내림하면 1ms 안에 남은 경계가 0이 돼 기본 TTL로 늘어난다
    .map((boundary) =>
      at
        .until(boundary, { smallestUnit: "millisecond", roundingMode: "ceil" })
        .total("milliseconds"),
    )
    .filter((remainingMs) => remainingMs > 0);
  return Math.min(USER_PROFILE_CACHE_TTL_MS, ...untilBoundaries);
}
