export const SUBSCRIPTION_WEBHOOK_LOCK = Symbol("SUBSCRIPTION_WEBHOOK_LOCK");

export interface SubscriptionWebhookLockPort {
	acquire(appUserId: string): Promise<(() => Promise<void>) | null>;
}
