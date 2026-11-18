import type { DailyCompletion } from "../../domain/daily-completion.aggregate.js";
import { countCompleteDays } from "../../domain/daily-completion.domain-service.js";
import type { DateRange } from "../../domain/date-range.vo.js";

export interface DailyCompletionReadModel {
  readonly date: Temporal.PlainDate;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly isComplete: boolean;
  readonly completionRate: number;
  readonly categoryColors: readonly string[];
}

export interface DailyCompletionRangeReadModel {
  readonly range: DateRange;
  /** 여러 날 할 일은 구간 안의 모든 날에 들어 있다 */
  readonly completions: readonly DailyCompletionReadModel[];
  readonly totalCompleteDays: number;
}

function toDailyCompletionReadModel(completion: DailyCompletion): DailyCompletionReadModel {
  const { date, totalTodos, completedTodos, categoryColors } = completion.toPrimitives();
  return {
    date,
    totalTodos,
    completedTodos,
    isComplete: completion.isComplete(),
    completionRate: completion.completionRate,
    categoryColors,
  };
}

export function toDailyCompletionRangeReadModel(
  range: DateRange,
  completions: readonly DailyCompletion[],
): DailyCompletionRangeReadModel {
  return {
    range,
    completions: completions.map(toDailyCompletionReadModel),
    totalCompleteDays: countCompleteDays(completions),
  };
}
