import { Inject, Injectable } from "@nestjs/common";

import { cacheKey } from "#api/shared/infrastructure/cache/index";
import { type ILockProvider, LOCK_PROVIDER } from "#api/shared/infrastructure/lock/index";

import type { NotificationDedupLockPort } from "../../application/ports/notification-dedup.port.js";
import { DEDUP_LOCK_TTL } from "../../domain/services/notification-dedup.js";

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
