import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import type { suggestion as suggestionTable } from "#api/platform/database/schema/ai-assistance.schema";

import type { SuggestionEvidencePrimitives } from "../../domain/suggestion-evidence.vo.js";
import { Suggestion } from "../../domain/suggestion.aggregate.js";

type SuggestionRow = typeof suggestionTable.$inferSelect;
type SuggestionInsertRow = typeof suggestionTable.$inferInsert;

const daysOfWeekSchema = z.array(z.enum(DAYS_OF_WEEK));
const matchedTodosSchema = z.array(z.string());

// 1.16.0 전 행은 근거 칸이 비어 있다. 셋이 모두 있을 때만 근거로 읽는다
function toEvidence(row: SuggestionRow): SuggestionEvidencePrimitives | null {
  const {
    evidenceRecordedCount: recordedCount,
    evidenceCompletedCount: completedCount,
    evidencePeriodDays: periodDays,
  } = row;
  if (recordedCount == null || completedCount == null || periodDays == null) {
    return null;
  }
  return { recordedCount, completedCount, periodDays };
}

export function toSuggestion(row: SuggestionRow): Suggestion {
  const days = daysOfWeekSchema.safeParse(row.daysOfWeek);
  const matched = matchedTodosSchema.safeParse(row.matchedTodos);
  return Suggestion.reconstitute({
    id: row.id,
    userId: row.userId,
    title: row.title,
    daysOfWeek: days.success ? days.data : null,
    scheduledTime: row.scheduledTime,
    confidence: row.confidence,
    reason: row.reason,
    matchedTodos: matched.success ? matched.data : [],
    suggestedCategoryId: row.suggestedCategoryId,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    evidence: toEvidence(row),
  });
}

export function toSuggestionRow(suggestion: Suggestion): SuggestionInsertRow {
  const { evidence, ...primitives } = suggestion.toPrimitives();
  return {
    ...primitives,
    daysOfWeek: primitives.daysOfWeek ?? [],
    matchedTodos: [...primitives.matchedTodos],
    evidenceRecordedCount: evidence?.recordedCount ?? null,
    evidenceCompletedCount: evidence?.completedCount ?? null,
    evidencePeriodDays: evidence?.periodDays ?? null,
  };
}
