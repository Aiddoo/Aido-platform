import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  resolveNotificationInboxScope,
  visibleNotificationTypes,
} from "../../../push/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationInboxReaderPort } from "../ports/notification-inbox.reader.port.js";

export interface GetUnreadNotificationCountQuery {
  readonly userId: string;
  readonly appVersion?: string;
}

export interface GetUnreadNotificationCountDependencies {
  readonly notificationInboxReader: Pick<NotificationInboxReaderPort, "countUnread">;
  readonly cache: Pick<NotificationCachePort, "wrapUnreadCount">;
}

export class GetUnreadNotificationCountUseCase {
  readonly #dependencies: GetUnreadNotificationCountDependencies;

  constructor(dependencies: GetUnreadNotificationCountDependencies) {
    this.#dependencies = dependencies;
  }

  execute(query: GetUnreadNotificationCountQuery): Promise<number> {
    const { notificationInboxReader, cache } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    // 앱 버전마다 보이는 타입이 달라 캐시도 버전 범위별로 나눈다
    return cache.wrapUnreadCount(
      userId,
      () => notificationInboxReader.countUnread(userId, visibleNotificationTypes(query.appVersion)),
      resolveNotificationInboxScope(query.appVersion),
    );
  }
}
