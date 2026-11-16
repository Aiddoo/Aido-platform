import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";

export abstract class SuggestionAnalysisRunRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<SuggestionAnalysisRun | null>;
  abstract listByUserIds(userIds: readonly UserId[]): Promise<SuggestionAnalysisRun[]>;
  abstract save(run: SuggestionAnalysisRun): Promise<void>;
  abstract saveMany(runs: readonly SuggestionAnalysisRun[]): Promise<void>;
}
