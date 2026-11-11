import { Injectable } from "@nestjs/common";

import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { LockProviderPort } from "#api/platform/lock/lock-provider.port";

import type { NotificationDedupLockPort } from "../../application/ports/notification-dedup.port.js";
import { DEDUP_LOCK_TTL } from "../../domain/notification-dedup.domain-service.js";

/** 알림 중복 잠금의 Redis keyspace와 TTL을 소유한다. */
@Injectable()
export class NotificationDedupLockAdapter implements NotificationDedupLockPort {
  readonly #lockProvider: LockProviderPort;

  constructor(lockProvider: LockProviderPort) {
    this.#lockProvider = lockProvider;
  }

  acquire(dedupKey: string): Promise<(() => Promise<void>) | null> {
    return this.#lockProvider.acquire(
      cacheKey("notification", "lock-dedup", dedupKey),
      DEDUP_LOCK_TTL,
    );
  }
}
