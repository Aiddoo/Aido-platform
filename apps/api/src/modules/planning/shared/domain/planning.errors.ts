import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function todoTitleLengthOutOfRange(titleLength: number, minLength: number): DomainException {
  return new DomainException(
    ErrorCode.SYS_0002,
    { titleLength, max: TODO_LIMITS.TITLE_MAX_LENGTH },
    { message: `제목은 ${minLength}~${TODO_LIMITS.TITLE_MAX_LENGTH}자여야 합니다.` },
  );
}

export function checklistLimitReached(currentCount: number): DomainException {
  return new DomainException(ErrorCode.TODO_0821, {
    currentCount,
    maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
  });
}
