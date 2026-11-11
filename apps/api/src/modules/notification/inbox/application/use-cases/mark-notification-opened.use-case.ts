import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationDeliveryLogEvent } from "../../../push/application/notification-delivery.log-events.js";
import { NotificationId } from "../../domain/notification-id.vo.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

export interface MarkNotificationOpenedCommand {
  readonly userId: string;
  readonly notificationId: number;
}

export interface MarkNotificationOpenedDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "markAsOpened">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 푸시 탭은 재시도될 수 있어 처음 연 기록만 남기고, 남의 알림·없는 알림도 오류 없이 false다
export class MarkNotificationOpenedUseCase {
  readonly #dependencies: MarkNotificationOpenedDependencies;

  constructor(dependencies: MarkNotificationOpenedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkNotificationOpenedCommand): Promise<boolean> {
    const { notificationRepository, cache, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const isOpened = await notificationRepository.markAsOpened(
      NotificationId.reconstitute(command.notificationId),
      userId,
      clock.now(),
    );
    if (isOpened) {
      await cache.invalidateUnreadCount(userId);
      logger.log({
        event: NotificationDeliveryLogEvent.PUSH_OPENED,
        userId: command.userId,
        notificationId: command.notificationId,
      });
    }
    return isOpened;
  }
}
