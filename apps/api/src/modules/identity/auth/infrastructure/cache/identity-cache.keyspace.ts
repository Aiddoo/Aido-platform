import { storeRenewalGraceEndsAt } from "#api/modules/billing/subscriptions/billing-subscriptions-entitlement.public";
import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

export const IDENTITY_CACHE_TTL_MS = { SESSION: 30_000, USER_PROFILE: 5 * 60_000 } as const;
export const IdentityCacheKey = {
  session: (sessionId: string) => cacheKey("auth", "session", sessionId),
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
  profile: UserProfilePremiumBoundaries | undefined,
  at: Date,
): number {
  if (profile == null) {
    return IDENTITY_CACHE_TTL_MS.USER_PROFILE;
  }
  const untilBoundaries = [
    profile.subscriptionExpiresAt,
    profile.premiumEndsAt,
    profile.premiumPeriodEndsAt,
  ]
    .flatMap((iso) => (iso == null ? [] : [new Date(iso)]))
    .flatMap((endsAt) => [endsAt, instantToDate(storeRenewalGraceEndsAt(instantFromDate(endsAt)))])
    .map((boundary) => boundary.getTime() - at.getTime())
    .filter((remainingMs) => remainingMs > 0);
  return Math.min(IDENTITY_CACHE_TTL_MS.USER_PROFILE, ...untilBoundaries);
}
