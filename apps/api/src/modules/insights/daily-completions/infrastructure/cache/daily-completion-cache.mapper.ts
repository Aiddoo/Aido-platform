import { z } from "zod";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailyCompletionRange } from "../../application/read-models/daily-completion-range.read-model.js";
import { DailyCompletion } from "../../domain/daily-completion.aggregate.js";
import { DateRange } from "../../domain/date-range.vo.js";

const PLAIN_DATE_SCHEMA = z.iso.date().transform((value) => Temporal.PlainDate.from(value));

// 배포 사이 이전·다음 버전이 같은 키를 읽으므로 저장 모양은 응답 계약과 같은 JSON 그대로 둔다
export const DAILY_COMPLETION_RANGE_ROW_SCHEMA = z.object({
  completions: z.array(
    z.object({
      date: PLAIN_DATE_SCHEMA,
      totalTodos: z.number(),
      completedTodos: z.number(),
      isComplete: z.boolean(),
      completionRate: z.number(),
      categoryColors: z.array(z.string()),
    }),
  ),
  totalCompleteDays: z.number(),
  // 여러 날 할 일을 시작일에만 세던 이전 값은 기간이 남아 있어 미스로 보고 다시 센다
  multiDayTodos: z.array(z.unknown()).max(0).optional(),
  dateRange: z.object({ startDate: PLAIN_DATE_SCHEMA, endDate: PLAIN_DATE_SCHEMA }),
});

type DailyCompletionRangeRow = z.infer<typeof DAILY_COMPLETION_RANGE_ROW_SCHEMA>;
type DailyCompletionRangeInsertRow = z.input<typeof DAILY_COMPLETION_RANGE_ROW_SCHEMA>;

export function toDailyCompletionRange(
  userId: UserId,
  row: DailyCompletionRangeRow,
): DailyCompletionRange {
  return {
    range: DateRange.create(row.dateRange.startDate, row.dateRange.endDate),
    completions: row.completions.map((completion) =>
      DailyCompletion.reconstitute({
        userId: userId.value,
        date: completion.date,
        totalTodos: completion.totalTodos,
        completedTodos: completion.completedTodos,
        categoryColors: completion.categoryColors,
      }),
    ),
    totalCompleteDays: row.totalCompleteDays,
  };
}

export function toDailyCompletionRangeRow(
  value: DailyCompletionRange,
): DailyCompletionRangeInsertRow {
  return {
    completions: value.completions.map((completion) => ({
      date: completion.date.toString(),
      totalTodos: completion.totalTodos,
      completedTodos: completion.completedTodos,
      isComplete: completion.isComplete(),
      completionRate: completion.completionRate,
      categoryColors: [...completion.categoryColors],
    })),
    totalCompleteDays: value.totalCompleteDays,
    multiDayTodos: [],
    dateRange: { startDate: value.range.start.toString(), endDate: value.range.end.toString() },
  };
}
