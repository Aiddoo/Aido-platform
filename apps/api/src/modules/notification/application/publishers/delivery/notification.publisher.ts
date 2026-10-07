import type { NotificationRecord } from "../../../domain/records/delivery/notification.record.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { SendBatchNotification } from "../../use-cases/delivery/send-batch-notification.use-case.js";
import type { SendNotificationWithDedup } from "../../use-cases/delivery/send-notification-with-dedup.use-case.js";
import type { SendNotification } from "../../use-cases/delivery/send-notification.use-case.js";

/** 다른 모듈에 노출하는 알림 발행 capability. */
export class NotificationPublisher {
  constructor(
    private readonly sendNotification: SendNotification,
    private readonly sendNotificationWithDeduplication: SendNotificationWithDedup,
    private readonly sendBatchNotification: SendBatchNotification,
  ) {}

  publish(data: CreateNotificationData): Promise<NotificationRecord | null> {
    return this.sendNotification.execute(data);
  }

  publishWithDeduplication(data: CreateNotificationData): Promise<NotificationRecord | null> {
    return this.sendNotificationWithDeduplication.execute(data);
  }

  publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
    return this.sendBatchNotification.execute(items);
  }
}
