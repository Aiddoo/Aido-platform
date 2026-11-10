import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

export const ApplicationExceptions = {
  todoNotFound(todoId: number) {
    return new ApplicationException(ErrorCode.TODO_0801, { todoId });
  },

  invalidParameter(details?: unknown) {
    return new ApplicationException(ErrorCode.SYS_0002, details);
  },

  internalServerError(details?: unknown) {
    return new ApplicationException(ErrorCode.SYS_0001, details);
  },

  concurrentModification() {
    return new ApplicationException(ErrorCode.SYS_0004);
  },

  emailAlreadyRegistered(email: string) {
    return new ApplicationException(ErrorCode.EMAIL_0501, {
      email,
    });
  },

  accountAlreadyExists(details?: unknown) {
    return new ApplicationException(ErrorCode.USER_0604, details);
  },

  followRequestAlreadySent(targetUserId: string) {
    return new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId });
  },

  todoCategoryNotFound(categoryId: number) {
    return new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
  },

  todoCategoryNameDuplicate(name: string) {
    return new ApplicationException(ErrorCode.TODO_CATEGORY_0853, { name });
  },

  weatherServiceUnavailable(details?: unknown) {
    return new ApplicationException(ErrorCode.WEATHER_1901, details);
  },
};
