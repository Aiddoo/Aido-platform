import { CATEGORY_TYPE_MAP, type NotificationCategory } from "@aido/api/vocabulary";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { visibleNotificationTypes } from "../../../domain/services/delivery/notification-client-capability.js";
import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationInboxReaderPort } from "../../ports/delivery/notification-inbox.reader.port.js";
import type { NotificationRecord } from "../../read-models/delivery/notification.read-model.js";

export interface GetNotificationsInput {
  userId: string;
  cursor?: number;
  size?: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
  appVersion?: string;
}

/**
 * 알림 목록 조회 유스케이스 (커서 기반 페이지네이션).
 *
 * 카테고리 필터를 알림 타입 목록으로 변환하고, DTO 매핑은 프레젠테이션에 위임한다.
 */
interface GetNotificationsDependencies {
  readonly notificationInboxReader: Pick<NotificationInboxReaderPort, "findNotificationsByUser">;
  readonly paginationService: Pick<
    PaginationService,
    "createCursorPaginatedResponse" | "normalizeCursorPagination"
  >;
  readonly logger: Pick<ApplicationLogger, "debug">;
}

export class GetNotifications {
  readonly #dependencies: GetNotificationsDependencies;

  constructor(dependencies: GetNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: GetNotificationsInput,
  ): Promise<CursorPaginatedResponse<NotificationRecord, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );

    const types: NotificationType[] | undefined =
      input.category && input.category !== "ALL"
        ? [...CATEGORY_TYPE_MAP[input.category]]
        : undefined;

    const notifications = await this.#dependencies.notificationInboxReader.findNotificationsByUser({
      userId: input.userId,
      cursor,
      size,
      unreadOnly: input.unreadOnly,
      types: visibleNotificationTypes(input.appVersion, types),
    });

    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.GET_NOTIFICATIONS_LISTED,
      userId: input.userId,
      count: notifications.length,
    });

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      NotificationRecord,
      number
    >({
      items: notifications,
      size,
    });
  }
}
