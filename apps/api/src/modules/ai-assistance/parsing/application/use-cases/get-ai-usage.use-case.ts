import type {
  MeteredFeatureQuota,
  QuotaLedgerPort,
} from "#api/modules/access/quotas/access-quotas.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface GetAiUsageQuery {
  readonly userId: string;
}

interface GetAiUsageDependencies {
  readonly quota: Pick<QuotaLedgerPort, "read">;
}

/** parse-todo·parse-memo·빠른 계획이 함께 쓰는 AI_PARSE 월간 사용량 */
export class GetAiUsageUseCase {
  readonly #dependencies: GetAiUsageDependencies;

  constructor(dependencies: GetAiUsageDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetAiUsageQuery): Promise<MeteredFeatureQuota> {
    return this.#dependencies.quota.read(UserId.reconstitute(input.userId), "AI_PARSE");
  }
}
