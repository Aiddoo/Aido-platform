import { toIsoString } from "#api/shared/domain/time/instant";

import {
  toFeatureQuotaDetails,
  type FeatureQuotaDetails,
} from "../../../entitlements/application/read-models/feature-quota.read-model.js";
import type { MeteredQuotaState } from "../../domain/quota-allowance.vo.js";

/** 계량기 기능의 featureQuota. 사용량을 항상 세므로 used·resetsAt이 있다. */
export type MeteredFeatureQuota = FeatureQuotaDetails & {
  readonly used: number;
  readonly resetsAt: string;
};

export function toMeteredFeatureQuota(state: MeteredQuotaState): MeteredFeatureQuota {
  return {
    ...toFeatureQuotaDetails(state),
    used: state.used,
    resetsAt: toIsoString(state.resetsAt),
  };
}
