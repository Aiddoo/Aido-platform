import { Injectable } from "@nestjs/common";

import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { LockProviderPort } from "#api/platform/lock/lock-provider.port";

import { SubscriptionWebhookLockPort } from "../../application/ports/subscription-webhook-lock.port.js";

const REVENUECAT_WEBHOOK_LOCK_TTL_MS = 10_000;

@Injectable()
export class SubscriptionWebhookLockAdapter extends SubscriptionWebhookLockPort {
  readonly #lockProvider: LockProviderPort;

  constructor(lockProvider: LockProviderPort) {
    super();
    this.#lockProvider = lockProvider;
  }

  acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
    return this.#lockProvider.acquire(
      cacheKey("subscription", "lock-revenuecat-webhook", appUserId),
      REVENUECAT_WEBHOOK_LOCK_TTL_MS,
    );
  }
}
