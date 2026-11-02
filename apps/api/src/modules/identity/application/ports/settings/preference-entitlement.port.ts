import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

export type PreferenceEntitlementPort = Pick<EntitlementReaderPort, "can">;

export const PREFERENCE_ENTITLEMENT = Symbol("PREFERENCE_ENTITLEMENT");
