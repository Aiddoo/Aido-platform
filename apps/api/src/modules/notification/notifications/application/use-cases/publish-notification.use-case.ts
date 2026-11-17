import type { CreateNotificationData } from "../../../shared/application/ports/notification-draft.port.js";
import { withTodoTargets } from "../notification-todo-target.mapper.js";
import type { NotificationTodoTargetReaderPort } from "../ports/notification-todo-target.reader.port.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";
import type { SendNotificationUseCase } from "./send-notification.use-case.js";

interface PublishNotificationDependencies {
  readonly sendNotification: Pick<SendNotificationUseCase, "execute">;
  readonly todoTargetReader: Pick<NotificationTodoTargetReaderPort, "findTodoTargets">;
}

// 다른 Context가 알림 하나를 만드는 문이다
export class PublishNotificationUseCase {
  readonly #dependencies: PublishNotificationDependencies;

  constructor(dependencies: PublishNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<InboxNotificationReadModel | null> {
    const [withTarget] = await withTodoTargets([data], this.#dependencies.todoTargetReader);
    return this.#dependencies.sendNotification.execute(withTarget ?? data);
  }
}
