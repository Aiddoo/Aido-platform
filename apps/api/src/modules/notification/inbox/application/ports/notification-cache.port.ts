import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationInboxScope } from "../../../push/domain/notification-client-capability.domain-service.js";

export abstract class NotificationCachePort {
  abstract wrapUnreadCount(
    userId: UserId,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number>;
  abstract invalidateUnreadCount(userId: UserId): Promise<void>;
  abstract invalidatePushTokens(userId: UserId): Promise<void>;
  // user-settings가 소유한 키다. 푸시 기기 보고가 시간대·언어 설정 행을 바꿀 때 함께 비운다
  abstract invalidateUserPreference(userId: UserId): Promise<void>;
}
