import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/access-entitlement.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { Suggestion } from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import { AiSuggestionLogEvent } from "../../observability/suggestions/ai-suggestion-log.events.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";

/**
 * 대기 중인 제안 목록 조회 use-case.
 *
 * 프리미엄 접근을 강제한 뒤 PENDING·미만료 제안을 조회한다.
 */
interface GetPendingSuggestionsDependencies {
  readonly repository: Pick<AiSuggestionRepositoryPort, "findPendingByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

export class GetPendingSuggestions {
  readonly #dependencies: GetPendingSuggestionsDependencies;

  constructor(dependencies: GetPendingSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<Suggestion[]> {
    if (!(await this.#dependencies.entitlementReader.can(userId, "AI_SUGGESTION"))) {
      this.#dependencies.logger.warn({ event: AiSuggestionLogEvent.PREMIUM_DENIED, userId });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }

    return this.#dependencies.repository.findPendingByUserId(userId);
  }
}
