export interface CachedSubscriptionState {
  readonly status: string | null;
  readonly isAdmin: boolean;
}

export const ENTITLEMENT_CACHE = Symbol("ENTITLEMENT_CACHE");

export interface EntitlementCachePort {
  wrapSubscription(
    userId: string,
    factory: () => Promise<CachedSubscriptionState>,
  ): Promise<CachedSubscriptionState | null>;
}
