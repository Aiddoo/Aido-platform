import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { NotificationRecord } from "../../read-models/delivery/notification.read-model.js";
import type { SendBatchNotification } from "../../use-cases/delivery/send-batch-notification.use-case.js";
import type { SendNotificationWithDedup } from "../../use-cases/delivery/send-notification-with-dedup.use-case.js";
import type { SendNotification } from "../../use-cases/delivery/send-notification.use-case.js";

interface NotificationPublisherDependencies {
  readonly sendNotification: Pick<SendNotification, "execute">;
  readonly sendNotificationWithDeduplication: Pick<SendNotificationWithDedup, "execute">;
  readonly sendBatchNotification: Pick<SendBatchNotification, "execute">;
}
/** 다른 모듈에 노출하는 알림 발행 capability. */
export class NotificationPublisher {
  readonly #dependencies: NotificationPublisherDependencies;
  constructor(dependencies: NotificationPublisherDependencies) {
    this.#dependencies = dependencies;
  }

  publish(data: CreateNotificationData): Promise<NotificationRecord | null> {
    return this.#dependencies.sendNotification.execute(data);
  }

  publishWithDeduplication(data: CreateNotificationData): Promise<NotificationRecord | null> {
    return this.#dependencies.sendNotificationWithDeduplication.execute(data);
  }

  publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
    return this.#dependencies.sendBatchNotification.execute(items);
  }
}
