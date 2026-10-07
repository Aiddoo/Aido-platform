import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

export class ApplicationExceptions {
  static todoNotFound(todoId: number) {
    return new ApplicationException(ErrorCode.TODO_0801, { todoId });
  }

  static invalidParameter(details?: unknown) {
    return new ApplicationException(ErrorCode.SYS_0002, details);
  }

  static internalServerError(details?: unknown) {
    return new ApplicationException(ErrorCode.SYS_0001, details);
  }

  static concurrentModification() {
    return new ApplicationException(ErrorCode.SYS_0004);
  }

  static emailAlreadyRegistered(email: string) {
    return new ApplicationException(ErrorCode.EMAIL_0501, {
      email,
    });
  }

  static accountAlreadyExists(details?: unknown) {
    return new ApplicationException(ErrorCode.USER_0604, details);
  }

  static followRequestAlreadySent(targetUserId: string) {
    return new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId });
  }

  static aiServiceUnavailable() {
    return new ApplicationException(ErrorCode.AI_1301);
  }

  static aiRateLimitExceeded() {
    return new ApplicationException(ErrorCode.AI_1310);
  }

  static todoCategoryNotFound(categoryId: number) {
    return new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
  }

  static todoCategoryNameDuplicate(name: string) {
    return new ApplicationException(ErrorCode.TODO_CATEGORY_0853, { name });
  }

  static weatherServiceUnavailable(details?: unknown) {
    return new ApplicationException(ErrorCode.WEATHER_1901, details);
  }
}
