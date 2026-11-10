import { NotificationCachePort } from "#api/modules/notification/inbox/application/ports/notification-cache.port";
import type { NotificationInboxScope } from "#api/modules/notification/push/domain/notification-client-capability.domain-service";

// 값을 저장하지 않고 매번 factory를 부른다. 어느 범위로 읽고 누구를 비웠는지만 남긴다
export class PassThroughNotificationCache extends NotificationCachePort {
  readonly readScopes: Array<NotificationInboxScope | undefined> = [];
  readonly invalidatedUnreadCountUserIds: string[] = [];
  readonly failUnreadCountInvalidationFor = new Set<string>();

  wrapUnreadCount(
    _userId: string,
    factory: () => Promise<number>,
    scope?: NotificationInboxScope,
  ): Promise<number> {
    this.readScopes.push(scope);
    return factory();
  }

  async invalidateUnreadCount(userId: string): Promise<void> {
    this.invalidatedUnreadCountUserIds.push(userId);
    if (this.failUnreadCountInvalidationFor.has(userId)) {
      throw new Error("synthetic cache failure");
    }
  }

  async invalidatePushTokens(): Promise<void> {}

  async invalidateUserPreference(): Promise<void> {}
}
