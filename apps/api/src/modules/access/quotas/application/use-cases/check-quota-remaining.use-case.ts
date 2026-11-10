import type { QuotaMeter } from "@aido/api/vocabulary";

import { QUOTA_METER_FEATURES } from "../../domain/quotas.constants.js";
import { quotaExhausted } from "../quotas.errors.js";
import { toMeteredFeatureQuota } from "../read-models/metered-feature-quota.read-model.js";
import type { GetMeteredFeatureQuotaUseCase } from "./get-metered-feature-quota.use-case.js";

export interface CheckQuotaRemainingQuery {
  readonly userId: string;
  readonly meter: QuotaMeter;
}

export interface CheckQuotaRemainingDependencies {
  readonly getMeteredFeatureQuota: Pick<GetMeteredFeatureQuotaUseCase, "execute">;
}

/**
 * 남은 횟수가 0이면 AI를 부르기 전에 차감 없이 막는다. 실제 차감은 UseCase가 잠금 트랜잭션 안에서 원장에
 * 예약할 때 한 번이고, 이 확인은 이미 한도에 닿은 요청을 일찍 돌려보내는 선검사다.
 */
export class CheckQuotaRemainingUseCase {
  readonly #dependencies: CheckQuotaRemainingDependencies;

  constructor(dependencies: CheckQuotaRemainingDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: CheckQuotaRemainingQuery): Promise<void> {
    const feature = QUOTA_METER_FEATURES[query.meter];
    const featureQuota = await this.#dependencies.getMeteredFeatureQuota.execute({
      userId: query.userId,
      feature,
    });
    if (featureQuota.remaining === 0) {
      throw quotaExhausted(feature, toMeteredFeatureQuota(featureQuota));
    }
  }
}
