import type { CreateNotificationData } from "../../../shared/application/ports/notification-draft.port.js";
import { withTodoTargets } from "../notification-todo-target.mapper.js";
import type { NotificationTodoTargetReaderPort } from "../ports/notification-todo-target.reader.port.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";
import type { SendNotificationWithDedupUseCase } from "./send-notification-with-dedup.use-case.js";

interface PublishDeduplicatedNotificationDependencies {
  readonly sendNotificationWithDeduplication: Pick<SendNotificationWithDedupUseCase, "execute">;
  readonly todoTargetReader: Pick<NotificationTodoTargetReaderPort, "findTodoTargets">;
}

// 같은 사용자·종류·대상의 알림이 중복 창 안에 있으면 만들지 않는 발행이다
export class PublishDeduplicatedNotificationUseCase {
  readonly #dependencies: PublishDeduplicatedNotificationDependencies;

  constructor(dependencies: PublishDeduplicatedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<InboxNotificationReadModel | null> {
    const [withTarget] = await withTodoTargets([data], this.#dependencies.todoTargetReader);
    return this.#dependencies.sendNotificationWithDeduplication.execute(withTarget ?? data);
  }
}
