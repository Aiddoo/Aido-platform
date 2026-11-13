import { Injectable } from "@nestjs/common";

import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { LockProviderPort } from "#api/platform/lock/lock-provider.port";

import { SubscriptionWebhookLockPort } from "../../application/ports/subscription-webhook-lock.port.js";

const WEBHOOK_LOCK_TTL_MS = 10_000;

@Injectable()
export class SubscriptionWebhookLockAdapter extends SubscriptionWebhookLockPort {
  readonly #lockProvider: LockProviderPort;

  constructor(lockProvider: LockProviderPort) {
    super();
    this.#lockProvider = lockProvider;
  }

  acquire(appUserId: string): Promise<(() => Promise<void>) | null> {
    return this.#lockProvider.acquire(
      // 키 문자열은 배포가 겹치는 동안 이전 버전과 같은 잠금을 잡도록 바꾸지 않는다
      cacheKey("subscription", "lock-revenuecat-webhook", appUserId),
      WEBHOOK_LOCK_TTL_MS,
    );
  }
}
