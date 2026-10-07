import type { NotificationCachePort } from "#api/modules/notification/application/ports/delivery/notification-cache.port";

/** 수신자별 캐시 상태와 invalidation 실패를 보여 주는 consumer-owned 대역. */
export class StubPushTokenCache implements Pick<NotificationCachePort, "invalidatePushTokens"> {
  readonly entries = new Map<string, readonly string[]>();
  readonly invalidationAttempts: string[] = [];
  readonly failForUsers = new Set<string>();

  async invalidatePushTokens(userId: string): Promise<void> {
    this.invalidationAttempts.push(userId);
    if (this.failForUsers.has(userId)) throw new Error("synthetic cache failure");
    this.entries.delete(userId);
  }
}
