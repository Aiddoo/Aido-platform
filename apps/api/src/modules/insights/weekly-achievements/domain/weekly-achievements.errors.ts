import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidIsoWeek(week: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "week", value: week });
}

export function invalidTotalTodos(totalTodos: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "totalTodos", value: totalTodos });
}

export function invalidCompletedTodos(completedTodos: number, totalTodos: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    field: "completedTodos",
    completedTodos,
    totalTodos,
  });
}
