import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { addDaysToKey, localDateKeyIn } from "../../shared/domain/todo-calendar.domain-service.js";

/** 규칙 시간대 기준 오늘 + VISIBLE_AHEAD_DAYS(그 날 포함)까지 회차를 미리 만든다. */
export function occurrenceHorizon(timezone: string, at: Date): string {
  return addDaysToKey(localDateKeyIn(at, timezone), TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS);
}
