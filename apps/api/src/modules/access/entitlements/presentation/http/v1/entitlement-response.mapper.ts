import { mapValues } from "es-toolkit";

import type { EntitlementSnapshot } from "../../../application/read-models/entitlement-snapshot.read-model.js";
import { toFeatureQuotaDetails } from "../../../application/read-models/feature-quota.read-model.js";
import type { EntitlementSnapshotDto } from "./entitlement.dto.js";

export function toEntitlementSnapshotResponse(
  snapshot: EntitlementSnapshot,
): EntitlementSnapshotDto {
  return {
    isPremium: snapshot.isPremium,
    tier: snapshot.tier,
    features: mapValues(snapshot.features, (featureQuota) => toFeatureQuotaDetails(featureQuota)),
  };
}
