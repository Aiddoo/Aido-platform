import { Inject, Injectable } from "@nestjs/common";

import { cacheKey } from "@/shared/infrastructure/cache";
import { type ILockProvider, LOCK_PROVIDER } from "@/shared/infrastructure/lock";

import type { SubscriptionWebhookLockPort } from "../../application/ports/subscription-webhook-lock.port";

const REVENUECAT_WEBHOOK_LOCK_TTL_MS = 10_000;

@Injectable()
export class SubscriptionWebhookLockAdapter implements SubscriptionWebhookLockPort {
	constructor(@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider) {}

	acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
		return this.lockProvider.acquire(
			cacheKey("subscription", "lock-revenuecat-webhook", appUserId),
			REVENUECAT_WEBHOOK_LOCK_TTL_MS,
		);
	}
}
