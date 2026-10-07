import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";

/** 푸시 탭을 멱등 기록하고 알림 센터 상태도 즉시 읽음으로 맞춘다. */
interface MarkNotificationOpenedDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "markAsOpened">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class MarkNotificationOpened {
  readonly #dependencies: MarkNotificationOpenedDependencies;

  constructor(dependencies: MarkNotificationOpenedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, notificationId: number): Promise<boolean> {
    const opened = await this.#dependencies.notificationRepository.markAsOpened(
      notificationId,
      userId,
    );
    if (opened) {
      await this.#dependencies.cache.invalidateUnreadCount(userId);
      this.#dependencies.logger.log({
        event: NotificationDeliveryLogEvent.MARK_NOTIFICATION_OPENED_OPENED,
        userId,
        notificationId,
      });
    }
    return opened;
  }
}
