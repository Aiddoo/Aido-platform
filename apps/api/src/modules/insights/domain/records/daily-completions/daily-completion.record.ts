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

export interface DailyCompletionsRange {
  readonly completions: readonly DailyCompletionSummary[];
  readonly totalCompleteDays: number;
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
}
