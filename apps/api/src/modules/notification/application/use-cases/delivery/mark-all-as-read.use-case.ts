import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { visibleNotificationTypes } from "../../../domain/services/delivery/notification-client-capability.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";

/**
 * 모든 알림 읽음 처리 유스케이스.
 */
interface MarkAllAsReadDependencies {
  readonly notificationRepository: NotificationRepositoryPort;
  readonly cache: NotificationCachePort;
  readonly logger: ApplicationLogger;
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

    this.#dependencies.logger.debug(
      `All notifications read processed: userId=${userId}, count=${result.count}`,
    );

    return result;
  }
}
