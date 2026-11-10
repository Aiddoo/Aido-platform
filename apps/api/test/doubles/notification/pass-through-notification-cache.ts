import { NotificationCachePort } from "#api/modules/notification/inbox/application/ports/notification-cache.port";
import type { NotificationInboxScope } from "#api/modules/notification/push/domain/notification-client-capability.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 값을 저장하지 않고 매번 factory를 부른다. 어느 범위로 읽고 누구를 비웠는지만 남긴다
export class PassThroughNotificationCache extends NotificationCachePort {
  readonly readScopes: Array<NotificationInboxScope | undefined> = [];
  readonly invalidatedUnreadCountUserIds: string[] = [];
  readonly invalidatedPushTokenUserIds: string[] = [];
  readonly invalidatedPreferenceUserIds: string[] = [];
  readonly failUnreadCountInvalidationFor = new Set<string>();
  readonly failPushTokenInvalidationFor = new Set<string>();

  wrapUnreadCount(
    _userId: UserId,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number> {
    this.readScopes.push(scope);
    return factory();
  }

  async invalidateUnreadCount(user: UserId): Promise<void> {
    const userId = user.value;
    this.invalidatedUnreadCountUserIds.push(userId);
    if (this.failUnreadCountInvalidationFor.has(userId)) {
      throw new Error("synthetic cache failure");
    }
  }

  async invalidatePushTokens(user: UserId): Promise<void> {
    const userId = user.value;
    this.invalidatedPushTokenUserIds.push(userId);
    if (this.failPushTokenInvalidationFor.has(userId)) {
      throw new Error("synthetic cache failure");
    }
  }

  async invalidateUserPreference(user: UserId): Promise<void> {
    const userId = user.value;
    this.invalidatedPreferenceUserIds.push(userId);
  }
}
