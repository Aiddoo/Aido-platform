import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import type { PendingSuggestionsReadModel } from "../read-models/suggestion-analysis.read-model.js";
import { SuggestionLogEvent } from "../suggestions.log-events.js";
import type { GetSuggestionAnalysisStateUseCase } from "./get-suggestion-analysis-state.use-case.js";

export interface ListPendingSuggestionsQuery {
  readonly userId: string;
}

interface ListPendingSuggestionsDependencies {
  readonly repository: Pick<SuggestionRepositoryPort, "listPendingByUserId">;
  readonly analysisState: Pick<GetSuggestionAnalysisStateUseCase, "execute">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class ListPendingSuggestionsUseCase {
  readonly #dependencies: ListPendingSuggestionsDependencies;

  constructor(dependencies: ListPendingSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListPendingSuggestionsQuery): Promise<PendingSuggestionsReadModel> {
    const userId = UserId.reconstitute(query.userId);
    if (!(await this.#dependencies.entitlementReader.can(userId, "AI_SUGGESTION"))) {
      this.#dependencies.logger.warn({
        event: SuggestionLogEvent.PREMIUM_DENIED,
        userId: query.userId,
      });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }
    const suggestions = await this.#dependencies.repository.listPendingByUserId(
      userId,
      this.#dependencies.clock.now(),
    );
    const analysis = await this.#dependencies.analysisState.execute({
      userId,
      pendingCount: suggestions.length,
    });
    return { suggestions, analysis };
  }
}
