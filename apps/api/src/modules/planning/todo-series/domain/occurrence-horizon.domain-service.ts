import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { localDateInTimezone } from "#api/shared/domain/date/utils/timezone";

/** 규칙 시간대 기준 오늘 + VISIBLE_AHEAD_DAYS(그 날 포함)까지 회차를 미리 만든다. */
export function occurrenceHorizon(timezone: string, at: Date): string {
  return addDaysToDateKey(localDateInTimezone(at, timezone), TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS);
}
