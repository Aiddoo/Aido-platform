import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationDeliveryLogEvent } from "../../../push/application/notification-delivery.log-events.js";
import { visibleNotificationTypes } from "../../../push/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

export interface MarkAllNotificationsReadCommand {
  readonly userId: string;
  readonly appVersion?: string;
}

export interface MarkAllNotificationsReadDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "markAllAsRead">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkAllNotificationsReadUseCase {
  readonly #dependencies: MarkAllNotificationsReadDependencies;

  constructor(dependencies: MarkAllNotificationsReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkAllNotificationsReadCommand): Promise<{ count: number }> {
    const { notificationRepository, cache, clock, logger } = this.#dependencies;
    // 이 앱이 볼 수 없는 알림은 읽음으로 바꾸지 않는다(새 앱으로 올리면 미읽음으로 보인다)
    const userId = UserId.reconstitute(command.userId);
    const result = await notificationRepository.markAllAsRead(
      userId,
      visibleNotificationTypes(command.appVersion),
      clock.now(),
    );
    await cache.invalidateUnreadCount(userId);

    logger.debug({
      event: NotificationDeliveryLogEvent.MARK_ALL_AS_READ_READ_ALL_PROCESSED,
      userId: command.userId,
      count: result.count,
    });
    return result;
  }
}
