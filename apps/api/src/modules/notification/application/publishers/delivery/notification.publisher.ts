import { uniq } from "es-toolkit";

import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { NotificationTodoTargetReaderPort } from "../../ports/delivery/notification-todo-target.reader.port.js";
import type { NotificationRecord } from "../../read-models/delivery/notification.read-model.js";
import type { SendBatchNotification } from "../../use-cases/delivery/send-batch-notification.use-case.js";
import type { SendNotificationWithDedup } from "../../use-cases/delivery/send-notification-with-dedup.use-case.js";
import type { SendNotification } from "../../use-cases/delivery/send-notification.use-case.js";

interface NotificationPublisherDependencies {
  readonly sendNotification: Pick<SendNotification, "execute">;
  readonly sendNotificationWithDeduplication: Pick<SendNotificationWithDedup, "execute">;
  readonly sendBatchNotification: Pick<SendBatchNotification, "execute">;
  readonly todoTargetReader: Pick<NotificationTodoTargetReaderPort, "findTodoTargets">;
}

/**
 * 다른 모듈에 노출하는 알림 발행 capability.
 *
 * 할 일이 대상인 알림(todoId)은 metadata에 그 할 일의 주인(`todoOwnerId`)과 날짜(`todoDate`)를 더한다.
 * metadata는 알림함 응답과 push payload의 routing으로 함께 나가므로, 앱이 펼친 화면에서
 * 그 사람의 그 날짜 피드를 연다. 지워진 할 일은 더하지 않는다.
 */
export class NotificationPublisher {
  readonly #dependencies: NotificationPublisherDependencies;
  constructor(dependencies: NotificationPublisherDependencies) {
    this.#dependencies = dependencies;
  }

  async publish(data: CreateNotificationData): Promise<NotificationRecord | null> {
    const [withTarget] = await this.#withTodoTargets([data]);
    return this.#dependencies.sendNotification.execute(withTarget ?? data);
  }

  async publishWithDeduplication(data: CreateNotificationData): Promise<NotificationRecord | null> {
    const [withTarget] = await this.#withTodoTargets([data]);
    return this.#dependencies.sendNotificationWithDeduplication.execute(withTarget ?? data);
  }

  async publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
    return this.#dependencies.sendBatchNotification.execute(await this.#withTodoTargets(items));
  }

  async #withTodoTargets(items: CreateNotificationData[]): Promise<CreateNotificationData[]> {
    const todoIds = uniq(items.flatMap((item) => (item.todoId == null ? [] : [item.todoId])));
    if (todoIds.length === 0) {
      return items;
    }

    const targets = await this.#dependencies.todoTargetReader.findTodoTargets(todoIds);
    return items.map((item) => {
      const target = item.todoId == null ? undefined : targets.get(item.todoId);
      if (target == null) {
        return item;
      }
      return {
        ...item,
        metadata: { ...item.metadata, todoOwnerId: target.ownerId, todoDate: target.date },
      };
    });
  }
}
