import type { NotificationCategory } from "@aido/api/vocabulary";

import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationDeliveryLogEvent } from "../../../push/application/notification-delivery.log-events.js";
import {
  notificationTypesOfCategory,
  visibleNotificationTypes,
} from "../../../push/domain/notification-client-capability.domain-service.js";
import { NotificationId } from "../../domain/notification-id.vo.js";
import type { NotificationInboxReaderPort } from "../ports/notification-inbox.reader.port.js";
import type { InboxNotification } from "../read-models/inbox-notification.read-model.js";

export interface ListNotificationsQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly unreadOnly?: boolean;
  readonly category?: NotificationCategory;
  readonly appVersion?: string;
}

export interface ListNotificationsDependencies {
  readonly notificationInboxReader: Pick<NotificationInboxReaderPort, "listByUser">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class ListNotificationsUseCase {
  readonly #dependencies: ListNotificationsDependencies;

  constructor(dependencies: ListNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListNotificationsQuery): Promise<CursorPage<InboxNotification, number>> {
    const { notificationInboxReader, logger } = this.#dependencies;
    const size = clampPageSize(query.size);
    const categoryTypes =
      query.category == null || query.category === "ALL"
        ? undefined
        : notificationTypesOfCategory(query.category);

    const notifications = await notificationInboxReader.listByUser({
      userId: UserId.reconstitute(query.userId),
      afterNotificationId: query.cursor == null ? null : NotificationId.reconstitute(query.cursor),
      limit: size + 1,
      unreadOnly: query.unreadOnly === true,
      types: visibleNotificationTypes(query.appVersion, categoryTypes),
    });

    logger.debug({
      event: NotificationDeliveryLogEvent.GET_NOTIFICATIONS_LISTED,
      userId: query.userId,
      count: notifications.length,
    });
    return toCursorPage({
      rows: notifications,
      size,
      toCursor: (notification) => notification.id,
    });
  }
}
