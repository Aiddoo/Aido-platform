import {
  toFeatureQuotaReadModel,
  type FeatureQuotaReadModel,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { MeteredQuotaState } from "../../domain/quota-allowance.vo.js";

/** 계량기 기능의 featureQuota. 사용량을 항상 세므로 used·resetsAt이 있다. */
export type MeteredFeatureQuotaReadModel = FeatureQuotaReadModel & {
  readonly used: number;
  readonly resetsAt: string;
};

export function toMeteredFeatureQuotaReadModel(
  state: MeteredQuotaState,
): MeteredFeatureQuotaReadModel {
  return {
    ...toFeatureQuotaReadModel(state),
    used: state.used,
    resetsAt: toIsoString(state.resetsAt),
  };
}
