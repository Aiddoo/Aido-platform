import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import { notificationNotFound } from "../notifications.errors.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

export interface MarkNotificationReadCommand {
  readonly userId: string;
  readonly notificationId: number;
}

export interface MarkNotificationReadDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "findById" | "save">;
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

    const isChanged = await notificationRepository.save(notification);
    if (isChanged) {
      await cache.invalidateUnreadCount(userId);
    }

    logger.debug({
      event: NotificationLogEvent.MARK_AS_READ_READ_PROCESSED,
      notificationId: command.notificationId,
    });
  }
}
