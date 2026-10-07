import { Inject, Injectable } from "@nestjs/common";

import { cacheKey } from "#api/platform/cache/index";
import { type ILockProvider, LOCK_PROVIDER } from "#api/platform/lock/index";

import type { NotificationDedupLockPort } from "../../../application/ports/delivery/notification-dedup.port.js";
import { DEDUP_LOCK_TTL } from "../../../domain/services/delivery/notification-dedup.js";

/** 알림 중복 잠금의 Redis keyspace와 TTL을 소유한다. */
@Injectable()
export class NotificationDedupLockAdapter implements NotificationDedupLockPort {
  constructor(@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider) {}

  acquire(dedupKey: string): Promise<(() => Promise<void>) | null> {
    return this.lockProvider.acquire(
      cacheKey("notification", "lock-dedup", dedupKey),
      DEDUP_LOCK_TTL,
    );
  }
}
