import { ErrorCode } from "@aido/api/errors";
import type { TodoEditScope } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { RepeatSpec } from "../domain/repeat-rule.vo.js";

export function todoSeriesNotFound(seriesId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0841, { seriesId });
}

export function todoSeriesEnded(seriesId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0846, { seriesId });
}

// 반복 할 일이 아니라 범위를 고를 수 없다
export function todoNotRepeating(todoId: number, scope: TodoEditScope): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0844, { todoId, scope });
}

export function invalidRepeatRule(field: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0845, { field });
}

export function noRepeatDates(startDate: string, repeat: RepeatSpec): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0843, { startDate, repeat });
}

// limit은 경로마다 다르다. 옛 생성 경로는 옛 상한으로 센다
export function todoSeriesLimitReached(limit: number, activeCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0842, { limit, activeCount });
}
