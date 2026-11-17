import {
  SuggestionAnalysisRun,
  type SuggestionAnalysisRunPrimitives,
} from "#api/modules/ai-assistance/suggestions/domain/suggestion-analysis-run.entity";

import { SUGGESTION_FIXTURE_NOW, SUGGESTION_FIXTURE_USER_ID } from "./suggestion.fixture.js";

export const SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY = Temporal.PlainDate.from("2026-03-04");

export function createSuggestionAnalysisRunFixture(
  overrides: Partial<SuggestionAnalysisRunPrimitives> = {},
): SuggestionAnalysisRun {
  return SuggestionAnalysisRun.reconstitute({
    userId: SUGGESTION_FIXTURE_USER_ID,
    status: "QUEUED",
    localDate: SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY,
    trigger: "SCHEDULED",
    outcome: null,
    recentTodoCount: null,
    createdSuggestionCount: null,
    queuedAt: SUGGESTION_FIXTURE_NOW,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  });
}
