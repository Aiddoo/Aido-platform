import { Inject, Injectable } from "@nestjs/common";

import { cacheKey } from "#api/platform/cache/index";
import { type ILockProvider, LOCK_PROVIDER } from "#api/platform/lock/index";

import { SubscriptionWebhookLockPort } from "../../application/ports/subscription-webhook-lock.port.js";

const REVENUECAT_WEBHOOK_LOCK_TTL_MS = 10_000;

@Injectable()
export class SubscriptionWebhookLockAdapter extends SubscriptionWebhookLockPort {
  readonly #lockProvider: ILockProvider;

  constructor(@Inject(LOCK_PROVIDER) lockProvider: ILockProvider) {
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
