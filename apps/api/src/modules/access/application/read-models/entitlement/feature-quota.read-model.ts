import type { FeatureQuota } from "@aido/api";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { FeatureQuotaState } from "../../../domain/policies/entitlement/entitlement.policy.js";

/** 서버가 계산한 한도·사용량을 공개 계약 featureQuota로 바꾼다. */
export function toFeatureQuota(state: FeatureQuotaState): FeatureQuota {
  return { ...state, resetsAt: toISOStringOrNull(state.resetsAt) };
}
