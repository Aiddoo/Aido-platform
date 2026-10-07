import {
  resolveNotificationInboxScope,
  visibleNotificationTypes,
} from "../../../domain/services/delivery/notification-client-capability.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationInboxReaderPort } from "../../ports/delivery/notification-inbox.reader.port.js";

/**
 * 읽지 않은 알림 수 조회 유스케이스 (2분 캐시).
 */
interface GetUnreadCountDependencies {
  readonly notificationInboxReader: Pick<NotificationInboxReaderPort, "countUnread">;
  readonly cache: Pick<NotificationCachePort, "wrapUnreadCount">;
}

export class GetUnreadCount {
  readonly #dependencies: GetUnreadCountDependencies;

  constructor(dependencies: GetUnreadCountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, appVersion?: string): Promise<number> {
    return this.#dependencies.cache.wrapUnreadCount(
      userId,
      () =>
        this.#dependencies.notificationInboxReader.countUnread(
          userId,
          visibleNotificationTypes(appVersion),
        ),
      resolveNotificationInboxScope(appVersion),
    );
  }
}
