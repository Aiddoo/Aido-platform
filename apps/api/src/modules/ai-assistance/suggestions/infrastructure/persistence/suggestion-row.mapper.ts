import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import type { recurringSuggestion } from "#api/platform/database/schema/ai-assistance.schema";

import { Suggestion } from "../../domain/suggestion.aggregate.js";

type SuggestionRow = typeof recurringSuggestion.$inferSelect;
type SuggestionInsertRow = typeof recurringSuggestion.$inferInsert;

const daysOfWeekSchema = z.array(z.enum(DAYS_OF_WEEK));
const matchedTodosSchema = z.array(z.string());

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
  });
}

export function toSuggestionRow(suggestion: Suggestion): SuggestionInsertRow {
  const primitives = suggestion.toPrimitives();
  return {
    ...primitives,
    daysOfWeek: primitives.daysOfWeek ?? [],
    matchedTodos: [...primitives.matchedTodos],
  };
}
