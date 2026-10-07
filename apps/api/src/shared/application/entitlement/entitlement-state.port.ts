export interface EntitlementUserState {
	role: string;
	subscriptionStatus: string;
}

export const ENTITLEMENT_DATABASE = Symbol("ENTITLEMENT_DATABASE");

export interface EntitlementDatabasePort {
	findUserState(userId: string): Promise<EntitlementUserState | null>;
}

export interface CachedSubscriptionState {
	status: string | null;
	isAdmin: boolean;
}

export const ENTITLEMENT_CACHE = Symbol("ENTITLEMENT_CACHE");

export interface EntitlementCachePort {
	wrapSubscription(
		userId: string,
		factory: () => Promise<CachedSubscriptionState>,
	): Promise<CachedSubscriptionState | null>;
}
