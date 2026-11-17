import type {
  DailyCompletionSummary,
  DailyCompletionsRangeResponse,
} from "@aido/api/contracts/daily-completion/v1";

import type {
  DailyCompletionRangeReadModel,
  DailyCompletionReadModel,
} from "../../../application/read-models/daily-completion-range.read-model.js";

function toDailyCompletionSummaryResponse(
  completion: DailyCompletionReadModel,
): DailyCompletionSummary {
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
  result: DailyCompletionRangeReadModel,
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
