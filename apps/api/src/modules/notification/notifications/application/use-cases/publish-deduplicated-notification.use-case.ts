import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { withTodoTargets } from "../notification-todo-target.mapper.js";
import type { NotificationTodoTargetReaderPort } from "../ports/notification-todo-target.reader.port.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";
import type { SendNotificationWithDeduplicationUseCase } from "./send-notification-with-deduplication.use-case.js";

interface PublishDeduplicatedNotificationDependencies {
  readonly sendNotificationWithDeduplication: Pick<
    SendNotificationWithDeduplicationUseCase,
    "execute"
  >;
  readonly todoTargetReader: Pick<NotificationTodoTargetReaderPort, "listTodoTargets">;
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
