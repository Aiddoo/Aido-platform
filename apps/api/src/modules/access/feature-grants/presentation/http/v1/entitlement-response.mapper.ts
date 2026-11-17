import { mapValues } from "es-toolkit";

import type { EntitlementUsageReadModel } from "../../../application/read-models/entitlement-usage.read-model.js";
import { toFeatureQuotaReadModel } from "../../../application/read-models/feature-quota.read-model.js";
import type { EntitlementSnapshotDto } from "./entitlement.dto.js";

export function toEntitlementUsageResponse(
  entitlementUsage: EntitlementUsageReadModel,
): EntitlementSnapshotDto {
  return {
    isPremium: entitlementUsage.isPremium,
    tier: entitlementUsage.tier,
    features: mapValues(entitlementUsage.features, (featureQuota) =>
      toFeatureQuotaReadModel(featureQuota),
    ),
  };
}
