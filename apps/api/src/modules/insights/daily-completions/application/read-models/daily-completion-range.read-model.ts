import type { DailyCompletion } from "../../domain/daily-completion.entity.js";
import type { DateRange } from "../../domain/date-range.vo.js";

/** 조회 구간과 겹치는 여러 날 할 일. 집계는 시작일에만 세므로 1.15.0 앱이 기간 안의 나머지 날에 더한다 */
export interface MultiDayTodoSpan {
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly completed: boolean;
  readonly categoryColor: string;
}

export interface DailyCompletionRange {
  readonly range: DateRange;
  readonly completions: readonly DailyCompletion[];
  readonly totalCompleteDays: number;
  readonly multiDayTodos: readonly MultiDayTodoSpan[];
}
