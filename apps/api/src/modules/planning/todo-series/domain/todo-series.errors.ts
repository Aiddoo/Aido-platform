import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidRepeatRule(field: string): DomainException {
  return new DomainException(ErrorCode.TODO_0845, { field });
}

// repeat은 RepeatRule.toSpec()이다. 타입을 import하면 repeat-rule.vo와 순환한다
export function noRepeatDates(startDate: string, repeat: object): DomainException {
  return new DomainException(ErrorCode.TODO_0843, { startDate, repeat });
}
