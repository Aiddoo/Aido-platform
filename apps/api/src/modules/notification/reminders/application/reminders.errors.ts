import { ErrorCode } from "@aido/api/errors";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { ApplicationException } from "#api/shared/application/application.exception";

import type { NotificationId } from "../../notifications/domain/notification-id.vo.js";

/** 없거나 남의 할 일은 같은 코드로 거절해 있는지를 드러내지 않는다 */
export function reminderTodoNotFound(todoId: TodoId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId: todoId.value });
}

/** 없거나 남의 알림, 그 할 일을 알린 리마인드 알림이 아닌 알림은 모두 같은 코드로 거절한다 */
export function reminderNotificationNotFound(notificationId: NotificationId): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1004, {
    notificationId: notificationId.value,
  });
}

export function reminderTodoAlreadyCompleted(todoId: TodoId): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1007, { todoId: todoId.value });
}
