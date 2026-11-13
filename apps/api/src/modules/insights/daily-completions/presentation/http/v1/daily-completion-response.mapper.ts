import type {
  DailyCompletionSummary,
  DailyCompletionsRangeResponse,
} from "@aido/api/contracts/daily-completion";

import type { DailyCompletionRange } from "../../../application/read-models/daily-completion-range.read-model.js";
import type { DailyCompletion } from "../../../domain/daily-completion.aggregate.js";

function toDailyCompletionSummaryResponse(completion: DailyCompletion): DailyCompletionSummary {
  return {
    date: completion.date.toString(),
    totalTodos: completion.totalTodos,
    completedTodos: completion.completedTodos,
    isComplete: completion.isComplete(),
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
    // completions가 이미 기간의 모든 날을 세므로 비운다. 1.15.0 앱은 여기 기간을 받으면 나머지 날에 한 번 더 더한다
    multiDayTodos: [],
    dateRange: {
      startDate: result.range.start.toString(),
      endDate: result.range.end.toString(),
    },
  };
}
