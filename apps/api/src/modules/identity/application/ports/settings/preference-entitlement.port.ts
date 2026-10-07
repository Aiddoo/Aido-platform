export interface PreferenceEntitlementPort {
  hasPremiumAccess(userId: string): Promise<boolean>;
}

export const PREFERENCE_ENTITLEMENT = Symbol("PREFERENCE_ENTITLEMENT");
