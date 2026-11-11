import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationDeliveryLogEvent } from "../../../push/application/notification-delivery.log-events.js";
import { NotificationId } from "../../domain/notification-id.vo.js";
import { notificationNotFound } from "../inbox.errors.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

export interface MarkNotificationReadCommand {
  readonly userId: string;
  readonly notificationId: number;
}

export interface MarkNotificationReadDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "findById" | "markAsRead">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkNotificationReadUseCase {
  readonly #dependencies: MarkNotificationReadDependencies;

  constructor(dependencies: MarkNotificationReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkNotificationReadCommand): Promise<void> {
    const { notificationRepository, cache, clock, logger } = this.#dependencies;
    const notificationId = NotificationId.reconstitute(command.notificationId);

    const notification = await notificationRepository.findById(notificationId);
    if (notification == null) {
      throw notificationNotFound(notificationId);
    }
    const userId = UserId.reconstitute(command.userId);
    if (!notification.markRead(userId, clock.now())) {
      return;
    }

    const isChanged = await notificationRepository.markAsRead(notification);
    if (isChanged) {
      await cache.invalidateUnreadCount(userId);
    }

    logger.debug({
      event: NotificationDeliveryLogEvent.MARK_AS_READ_READ_PROCESSED,
      notificationId: command.notificationId,
    });
  }
}
