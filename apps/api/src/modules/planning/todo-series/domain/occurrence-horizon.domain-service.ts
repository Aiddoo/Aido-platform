import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { localDateIn } from "#api/shared/domain/time/timezone-name";

/** 규칙 시간대 기준 오늘 + VISIBLE_AHEAD_DAYS(그 날 포함)까지 회차를 미리 만든다. */
export function occurrenceHorizon(timezone: string, now: Temporal.Instant): Temporal.PlainDate {
  return localDateIn(now, timezone).add({ days: TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS });
}
