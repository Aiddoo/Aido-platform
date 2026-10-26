import type { ResourceBonuses } from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

export interface CachedSubscriptionState {
  readonly status: string | null;
  readonly isAdmin: boolean;
  /** 1.13.0 이전 캐시에는 없다. 없으면 기한 없이 status를 그대로 쓴다. */
  readonly accessDeadlineMs?: number | null;
  readonly resourceBonuses: ResourceBonuses;
}

export const ENTITLEMENT_CACHE = Symbol("ENTITLEMENT_CACHE");

export interface EntitlementCachePort {
  wrapSubscription(
    userId: string,
    factory: () => Promise<CachedSubscriptionState>,
  ): Promise<CachedSubscriptionState | null>;
}
