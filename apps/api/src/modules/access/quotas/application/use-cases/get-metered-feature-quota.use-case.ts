import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import {
  accessUserNotFound,
  type AccessStateReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaAllowance, type MeteredQuotaState } from "../../domain/quota-allowance.vo.js";
import type { QuotaUsageRepositoryPort } from "../ports/quota-usage.repository.port.js";

export interface GetMeteredFeatureQuotaQuery {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
}

export interface GetMeteredFeatureQuotaDependencies {
  readonly accessStateReader: Pick<AccessStateReaderPort, "findAccessState">;
  readonly quotaUsageRepository: Pick<QuotaUsageRepositoryPort, "countUsage">;
  readonly clock: ClockPort;
}

/** 계량기 기능의 이번 기간 한도·사용량. 차감하지 않고 읽기만 한다. */
export class GetMeteredFeatureQuotaUseCase {
  readonly #dependencies: GetMeteredFeatureQuotaDependencies;

  constructor(dependencies: GetMeteredFeatureQuotaDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetMeteredFeatureQuotaQuery): Promise<MeteredQuotaState> {
    const { accessStateReader, quotaUsageRepository, clock } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const state = await accessStateReader.findAccessState(userId);
    if (state == null) {
      throw accessUserNotFound(query.userId);
    }
    const allowance = QuotaAllowance.create({ feature: query.feature, state, now: clock.now() });
    const used = await quotaUsageRepository.countUsage({
      userId,
      meter: allowance.meter,
      window: allowance.window,
    });
    return allowance.toFeatureQuota(used);
  }
}
