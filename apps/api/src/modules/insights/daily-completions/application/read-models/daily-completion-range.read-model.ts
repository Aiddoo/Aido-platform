import type { DailyCompletion } from "../../domain/daily-completion.entity.js";
import type { DateRange } from "../../domain/date-range.vo.js";

export interface DailyCompletionRange {
  readonly range: DateRange;
  /** 여러 날 할 일은 구간 안의 모든 날에 들어 있다 */
  readonly completions: readonly DailyCompletion[];
  readonly totalCompleteDays: number;
}
