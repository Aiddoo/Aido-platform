import type {
  DailyCompletionSummary,
  DailyCompletionsRangeResponse,
} from "@aido/api/contracts/daily-completion";

import type { DailyCompletionRange } from "../../../application/read-models/daily-completion-range.read-model.js";
import type { DailyCompletion } from "../../../domain/daily-completion.entity.js";

function toDailyCompletionSummaryResponse(completion: DailyCompletion): DailyCompletionSummary {
  return {
    date: completion.date.toString(),
    totalTodos: completion.totalTodos,
    completedTodos: completion.completedTodos,
    isComplete: completion.isComplete,
    completionRate: completion.completionRate,
    categoryColors: [...completion.categoryColors],
  };
}

export function toDailyCompletionsRangeResponse(
  result: DailyCompletionRange,
): DailyCompletionsRangeResponse {
  return {
    completions: result.completions.map(toDailyCompletionSummaryResponse),
    totalCompleteDays: result.totalCompleteDays,
    multiDayTodos: result.multiDayTodos.map((span) => ({
      startDate: span.startDate.toString(),
      endDate: span.endDate.toString(),
      completed: span.completed,
      categoryColor: span.categoryColor,
    })),
    dateRange: {
      startDate: result.range.start.toString(),
      endDate: result.range.end.toString(),
    },
  };
}
