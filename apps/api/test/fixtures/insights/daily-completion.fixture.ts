import type { DailyCompletionRange } from "#api/modules/insights/daily-completions/application/read-models/daily-completion-range.read-model";
import {
  DailyCompletion,
  type DailyCompletionPrimitives,
} from "#api/modules/insights/daily-completions/domain/daily-completion.aggregate";
import { countCompleteDays } from "#api/modules/insights/daily-completions/domain/daily-completion.domain-service";
import { DateRange } from "#api/modules/insights/daily-completions/domain/date-range.vo";

export const DAILY_COMPLETION_FIXTURE_NOW = Temporal.Instant.from("2028-02-29T12:00:00Z");
export const DAILY_COMPLETION_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const DAILY_COMPLETION_FIXTURE_FRIEND_ID = "clz7x5p8k0002qz0z8z8z8z8z";

export function calendarDate(isoDate: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(isoDate);
}

export function createDateRangeFixture(start = "2028-02-01", end = "2028-02-29"): DateRange {
  return DateRange.create(calendarDate(start), calendarDate(end));
}

export function createDailyCompletionFixture(
  overrides: Partial<DailyCompletionPrimitives> = {},
): DailyCompletion {
  return DailyCompletion.reconstitute({
    userId: DAILY_COMPLETION_FIXTURE_USER_ID,
    date: calendarDate("2028-02-29"),
    totalTodos: 3,
    completedTodos: 3,
    categoryColors: ["#123456"],
    ...overrides,
  });
}

export function createDailyCompletionRangeFixture(
  overrides: Partial<Pick<DailyCompletionRange, "range" | "completions">> = {},
): DailyCompletionRange {
  const completions = overrides.completions ?? [createDailyCompletionFixture()];
  return {
    range: overrides.range ?? createDateRangeFixture(),
    completions,
    totalCompleteDays: countCompleteDays(completions),
  };
}

/** 저장소 계약과 InMemory 저장소에 심는 planning 할 일 한 개 */
export interface TodoSeed {
  readonly userId: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly completed: boolean;
  readonly categoryColor: string;
  readonly isPublic: boolean;
}

export function createTodoSeedFixture(overrides: Partial<TodoSeed> = {}): TodoSeed {
  return {
    userId: DAILY_COMPLETION_FIXTURE_USER_ID,
    startDate: calendarDate("2028-02-29"),
    endDate: null,
    completed: false,
    categoryColor: "#FF6B43",
    isPublic: true,
    ...overrides,
  };
}
