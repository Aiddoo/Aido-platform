import { SubscriptionWebhookLockPort } from "#api/modules/billing/subscriptions/application/ports/subscription-webhook-lock.port";

// 같은 사용자의 잠금을 한 번에 하나만 주고, 풀기 전에 또 요청하면 null이다
export class FakeSubscriptionWebhookLock extends SubscriptionWebhookLockPort {
  readonly held = new Set<string>();
  readonly acquiredAppUserIds: string[] = [];

  async acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
    this.acquiredAppUserIds.push(appUserId);
    if (this.held.has(appUserId)) {
      return null;
    }
    this.held.add(appUserId);
    return async () => {
      this.held.delete(appUserId);
    };
  }
}
