import { z } from "zod";

import type { suggestionAnalysisRun } from "#api/platform/database/schema/ai-assistance.schema";

import { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";
import {
  SUGGESTION_ANALYSIS_OUTCOMES,
  SUGGESTION_ANALYSIS_RUN_STATUSES,
  SUGGESTION_ANALYSIS_TRIGGERS,
} from "../../domain/suggestion-analysis.constants.js";

type SuggestionAnalysisRunRow = typeof suggestionAnalysisRun.$inferSelect;
type SuggestionAnalysisRunInsertRow = typeof suggestionAnalysisRun.$inferInsert;

// 배포가 겹치는 동안 새 서버가 더한 값을 옛 서버가 읽어도 제안 화면이 500이 되지 않게 끝난 실패로 읽는다
const statusSchema = z.enum(SUGGESTION_ANALYSIS_RUN_STATUSES).catch("FINISHED");
const triggerSchema = z.enum(SUGGESTION_ANALYSIS_TRIGGERS).catch("SCHEDULED");
const outcomeSchema = z.enum(SUGGESTION_ANALYSIS_OUTCOMES).nullable().catch("FAILED");

export function toSuggestionAnalysisRun(row: SuggestionAnalysisRunRow): SuggestionAnalysisRun {
  return SuggestionAnalysisRun.reconstitute({
    ...row,
    status: statusSchema.parse(row.status),
    trigger: triggerSchema.parse(row.trigger),
    outcome: outcomeSchema.parse(row.outcome),
  });
}

export function toSuggestionAnalysisRunRow(
  run: SuggestionAnalysisRun,
): SuggestionAnalysisRunInsertRow {
  return run.toPrimitives();
}
