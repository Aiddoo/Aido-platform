export interface TodoAggregateByDate {
  readonly date: Date;
  readonly total: number;
  readonly completed: number;
  readonly categoryColors: readonly string[];
}

export interface DailyCompletionSummary {
  readonly date: string;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly isComplete: boolean;
  readonly completionRate: number;
  readonly categoryColors: readonly string[];
}

/** 조회 기간과 겹치는 여러 날 할 일 하나 */
export interface MultiDayTodoSpan {
  readonly startDate: string;
  readonly endDate: string;
  readonly completed: boolean;
  readonly categoryColor: string;
}

export interface DailyCompletionsRange {
  readonly completions: readonly DailyCompletionSummary[];
  readonly totalCompleteDays: number;
  readonly multiDayTodos?: readonly MultiDayTodoSpan[];
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
}
