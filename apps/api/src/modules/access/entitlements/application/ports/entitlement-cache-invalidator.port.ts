export const ENTITLEMENT_SUBSCRIPTION_INVALIDATOR = Symbol("ENTITLEMENT_SUBSCRIPTION_INVALIDATOR");

export interface EntitlementSubscriptionInvalidatorPort {
  invalidateSubscription(userId: string): Promise<void>;
}
