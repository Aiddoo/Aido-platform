import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";

export interface GetAiUsageInput {
  readonly userId: string;
}

interface GetAiUsageDependencies {
  readonly quota: Pick<QuotaLedgerPort, "read">;
}

/** parse-todo·parse-memo·빠른 계획이 함께 쓰는 AI_PARSE 월간 사용량 */
export class GetAiUsage {
  readonly #dependencies: GetAiUsageDependencies;

  constructor(dependencies: GetAiUsageDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetAiUsageInput): Promise<MeteredFeatureQuota> {
    return this.#dependencies.quota.read(input.userId, "AI_PARSE");
  }
}
