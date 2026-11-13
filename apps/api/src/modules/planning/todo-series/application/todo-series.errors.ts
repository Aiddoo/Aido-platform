import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { RepeatSpec } from "../domain/repeat-rule.vo.js";

export function todoNotFound(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId });
}

export function todoSeriesNotFound(seriesId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0841, { seriesId });
}

export function todoSeriesEnded(seriesId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0846, { seriesId });
}

/** 반복 할 일이 아니라 "이후 모두" 범위를 고를 수 없다 */
export function todoNotRepeating(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0844, { todoId, scope: "THIS_AND_FOLLOWING" });
}

export function invalidRepeatRule(field: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0845, { field });
}

export function noRepeatDates(startDate: string, repeat: RepeatSpec): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0843, { startDate, repeat });
}

export function todoSeriesLimitReached(activeCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0842, {
    limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER,
    activeCount,
  });
}

export function categoryTodoLimitReached(activeCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0811, {
    activeCount,
    maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
  });
}
