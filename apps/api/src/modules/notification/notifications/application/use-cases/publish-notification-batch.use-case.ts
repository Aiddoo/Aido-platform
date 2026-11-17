import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { withTodoTargets } from "../notification-todo-target.mapper.js";
import type { NotificationTodoTargetReaderPort } from "../ports/notification-todo-target.reader.port.js";
import type { BatchNotificationOptions } from "./persist-batch-notification.use-case.js";
import type { SendBatchNotificationUseCase } from "./send-batch-notification.use-case.js";

interface PublishNotificationBatchDependencies {
  readonly sendBatchNotification: Pick<SendBatchNotificationUseCase, "execute">;
  readonly todoTargetReader: Pick<NotificationTodoTargetReaderPort, "findTodoTargets">;
}

// 정기 알림·관리자 공지처럼 여러 사람에게 한 번에 만드는 발행이다
export class PublishNotificationBatchUseCase {
  readonly #dependencies: PublishNotificationBatchDependencies;

  constructor(dependencies: PublishNotificationBatchDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    items: CreateNotificationData[],
    options: BatchNotificationOptions = {},
  ): Promise<{ count: number }> {
    return this.#dependencies.sendBatchNotification.execute(
      await withTodoTargets(items, this.#dependencies.todoTargetReader),
      options,
    );
  }
}
