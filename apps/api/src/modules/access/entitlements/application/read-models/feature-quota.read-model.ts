import { toIsoString } from "#api/shared/domain/time/instant";

import type { FeatureQuotaState } from "../../domain/entitlement.domain-service.js";

/**
 * 한도 오류 details와 다른 Context에 싣는 featureQuota. 시각은 출시 계약과 같은 ms 3자리 ISO 문자열이고,
 * 모양은 공개 계약 featureQuotaSchema와 같다.
 */
export type FeatureQuotaDetails = Omit<FeatureQuotaState, "resetsAt"> & {
  readonly resetsAt: string | null;
};

export function toFeatureQuotaDetails(state: FeatureQuotaState): FeatureQuotaDetails {
  return { ...state, resetsAt: state.resetsAt == null ? null : toIsoString(state.resetsAt) };
}
