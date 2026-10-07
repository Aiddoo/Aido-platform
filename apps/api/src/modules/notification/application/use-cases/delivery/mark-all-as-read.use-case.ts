import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { visibleNotificationTypes } from "../../../domain/services/delivery/notification-client-capability.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";

/**
 * 모든 알림 읽음 처리 유스케이스.
 */
interface MarkAllAsReadDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "markAllAsRead">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly logger: Pick<ApplicationLogger, "debug">;
}

export class MarkAllAsRead {
  readonly #dependencies: MarkAllAsReadDependencies;

  constructor(dependencies: MarkAllAsReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, appVersion?: string): Promise<{ count: number }> {
    const result = await this.#dependencies.notificationRepository.markAllAsRead(
      userId,
      visibleNotificationTypes(appVersion),
    );
    await this.#dependencies.cache.invalidateUnreadCount(userId);

    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.MARK_ALL_AS_READ_READ_ALL_PROCESSED,
      userId,
      count: result.count,
    });

    return result;
  }
}
