import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionAnalysisTrigger } from "../../domain/suggestion-analysis.constants.js";

export interface SuggestionAnalysisJob {
  readonly userId: UserId;
  readonly localDate: Temporal.PlainDate;
  readonly trigger: SuggestionAnalysisTrigger;
  readonly timezone: string;
}

export abstract class SuggestionAnalysisEnqueuerPort {
  abstract enqueue(job: SuggestionAnalysisJob): Promise<void>;
  abstract enqueueMany(jobs: readonly SuggestionAnalysisJob[]): Promise<void>;
}
