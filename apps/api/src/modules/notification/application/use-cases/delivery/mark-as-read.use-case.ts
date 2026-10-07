import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Notification } from "../../../domain/aggregates/delivery/notification.aggregate.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationInboxReaderPort } from "../../ports/delivery/notification-inbox.reader.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";

/**
 * 단일 알림 읽음 처리 유스케이스.
 *
 * 대상 부재는 NOTIFICATION_1004, 소유권 위반은 애그리게잇이 NOTIFICATION_1005로
 * 차단한다. 이미 읽은 알림은 무동작(멱등).
 */
interface MarkAsReadDependencies {
  readonly notificationInboxReader: Pick<NotificationInboxReaderPort, "findNotificationById">;
  readonly notificationRepository: Pick<NotificationRepositoryPort, "markAsRead">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly logger: Pick<ApplicationLogger, "debug">;
}

export class MarkAsRead {
  readonly #dependencies: MarkAsReadDependencies;

  constructor(dependencies: MarkAsReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, notificationId: number): Promise<void> {
    const record =
      await this.#dependencies.notificationInboxReader.findNotificationById(notificationId);

    if (record === null) {
      throw new ApplicationException(ErrorCode.NOTIFICATION_1004, {
        notificationId,
      });
    }

    const notification = Notification.reconstitute(record);
    if (!notification.planMarkRead(userId)) {
      return;
    }

    const changed = await this.#dependencies.notificationRepository.markAsRead(
      notificationId,
      userId,
    );
    if (changed) {
      await this.#dependencies.cache.invalidateUnreadCount(userId);
    }

    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.MARK_AS_READ_READ_PROCESSED,
      notificationId,
    });
  }
}
