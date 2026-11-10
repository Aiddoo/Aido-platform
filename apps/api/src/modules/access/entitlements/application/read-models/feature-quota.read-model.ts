import type { FeatureQuota } from "@aido/api";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { FeatureQuotaState } from "../../domain/entitlement.domain-service.js";

export function toFeatureQuota(state: FeatureQuotaState): FeatureQuota {
  return { ...state, resetsAt: toISOStringOrNull(state.resetsAt) };
}
