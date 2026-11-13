import { mapValues } from "es-toolkit";

import { toFeatureQuotaDetails } from "#api/modules/access/entitlements/access-entitlements.public";

import type { EntitlementUsageReadModel } from "../../../application/read-models/entitlement-usage.read-model.js";
import type { EntitlementSnapshotDto } from "./entitlement.dto.js";

export function toEntitlementUsageResponse(
  entitlementUsage: EntitlementUsageReadModel,
): EntitlementSnapshotDto {
  return {
    isPremium: entitlementUsage.isPremium,
    tier: entitlementUsage.tier,
    features: mapValues(entitlementUsage.features, (featureQuota) =>
      toFeatureQuotaDetails(featureQuota),
    ),
  };
}
