import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { Suggestion } from "../../domain/suggestion.aggregate.js";
import { AiSuggestionLogEvent } from "../ai-suggestion.log-events.js";
import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";

export interface ListPendingSuggestionsQuery {
  readonly userId: string;
}

interface ListPendingSuggestionsDependencies {
  readonly repository: Pick<SuggestionRepositoryPort, "listPendingByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/** 프리미엄 접근을 확인한 뒤 대기 중이고 만료되지 않은 제안을 최신순으로 준다. */
export class ListPendingSuggestionsUseCase {
  readonly #dependencies: ListPendingSuggestionsDependencies;

  constructor(dependencies: ListPendingSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListPendingSuggestionsQuery): Promise<Suggestion[]> {
    if (
      !(await this.#dependencies.entitlementReader.can(
        UserId.reconstitute(query.userId),
        "AI_SUGGESTION",
      ))
    ) {
      this.#dependencies.logger.warn({
        event: AiSuggestionLogEvent.PREMIUM_DENIED,
        userId: query.userId,
      });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }
    return this.#dependencies.repository.listPendingByUserId(
      UserId.reconstitute(query.userId),
      this.#dependencies.clock.now(),
    );
  }
}
