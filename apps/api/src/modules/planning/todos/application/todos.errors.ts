import { ErrorCode } from "@aido/api/errors";
import { type DayOfWeek, TODO_LIMITS, type TodoEditScope } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

export function todoNotFound(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId });
}

export function reorderTargetTodoNotFound(targetTodoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0810, { targetTodoId });
}

export function friendTodosForbidden(targetUserId: string): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0906, { targetUserId });
}

export function invalidDateRange(
  startDate: Temporal.PlainDate,
  endDate: Temporal.PlainDate,
): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, {
    message: "startDate must be less than or equal to endDate",
    startDate: startDate.toString(),
    endDate: endDate.toString(),
  });
}

/** 반복 할 일이 아닌데 범위(이번만·이후 모두)를 골랐다 */
export function todoNotRepeating(todoId: number, scope: TodoEditScope): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0844, { todoId, scope });
}

export function todoSeriesNotFound(seriesId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0841, { seriesId });
}

export function invalidRepeatRule(field: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0845, { field });
}

export function categoryTodoLimitReached(activeCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0811, {
    activeCount,
    maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
  });
}

/** 옛 반복 경로(1.14.x)의 한도 거절이다. 그 앱이 아는 코드라 TODO_0842 대신 쓴다 */
export function recurringTodoCategoryLimitReached(
  activeInCategory: number,
  maxPerCategory: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0813, {
    activeInCategory,
    batchSize: 1,
    maxPerCategory,
  });
}

export function todoSeriesLimitReached(limit: number, activeCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0842, { limit, activeCount });
}

/** 만든 할 일을 바로 다시 읽지 못했다(같은 트랜잭션이라 생기면 버그다) */
export function createdTodoMissing(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, { reason: "created todo missing" });
}

/** 출시 앱 계약: 옛 반복 경로(POST /v1/todos/recurring)의 날짜 없음은 TODO_0843이 아니라 SYS_0002다 */
export function recurringTodoHasNoDates(
  startDate: string,
  endDate: string,
  daysOfWeek: readonly DayOfWeek[],
): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, {
    message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
    startDate,
    endDate,
    daysOfWeek,
  });
}
