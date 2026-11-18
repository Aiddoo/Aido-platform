import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationInboxScope } from "../../../shared/domain/notification-client-capability.domain-service.js";

export abstract class NotificationCachePort {
  abstract wrapUnreadCount(
    userId: UserId,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number>;
  abstract invalidateUnreadCount(userId: UserId): Promise<void>;
}
