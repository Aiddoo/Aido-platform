export interface EntitlementUserState {
	role: string;
	subscriptionStatus: string;
}

export interface EntitlementTransaction {
	user: {
		findUnique(args: {
			where: { id: string };
			select: { role: true; subscriptionStatus: true };
		}): Promise<EntitlementUserState | null>;
	};
}

export const ENTITLEMENT_DATABASE = Symbol("ENTITLEMENT_DATABASE");

export interface EntitlementDatabasePort extends EntitlementTransaction {}

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
