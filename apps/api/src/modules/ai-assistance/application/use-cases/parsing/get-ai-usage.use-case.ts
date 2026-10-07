import type { AiUsageData } from "@aido/api";

import type { AiQuotaPort } from "../../ports/parsing/ai-quota.port.js";

export interface GetAiUsageInput {
  readonly userId: string;
}

interface GetAiUsageDependencies {
  readonly quota: Pick<AiQuotaPort, "read">;
}

export class GetAiUsage {
  readonly #dependencies: GetAiUsageDependencies;

  constructor(dependencies: GetAiUsageDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetAiUsageInput): Promise<AiUsageData> {
    return this.#dependencies.quota.read(input.userId);
  }
}
