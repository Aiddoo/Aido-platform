export abstract class SubscriptionWebhookLockPort {
  /** 잠금을 얻으면 해제 함수를, 이미 다른 요청이 잡고 있으면 null을 돌려준다. */
  abstract acquire(appUserId: string): Promise<(() => Promise<void>) | null>;
}
