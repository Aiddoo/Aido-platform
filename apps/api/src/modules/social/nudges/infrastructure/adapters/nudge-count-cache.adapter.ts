import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NudgeCountCachePort,
  ReceivedNudgeCounts,
} from "../../application/ports/nudge-count-cache.port.js";
import {
  NUDGE_COUNT_CACHE_TTL_MS,
  NudgeCountCacheKey,
} from "../cache/nudge-count-cache.keyspace.js";

const RECEIVED_COUNTS_SCHEMA = z.object({ total: z.number(), unread: z.number() });

@Injectable()
export class NudgeCountCacheAdapter implements NudgeCountCachePort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  wrapReceivedCounts(
    userId: UserId,
    factory: () => Promise<ReceivedNudgeCounts>,
  ): Promise<ReceivedNudgeCounts> {
    return this.#cache.wrap(
      NudgeCountCacheKey.received(userId.value),
      RECEIVED_COUNTS_SCHEMA,
      factory,
      NUDGE_COUNT_CACHE_TTL_MS,
    );
  }

  wrapSentCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    return this.#cache.wrap(
      NudgeCountCacheKey.sent(userId.value),
      z.number(),
      factory,
      NUDGE_COUNT_CACHE_TTL_MS,
    );
  }

  async invalidate(userIds: readonly UserId[]): Promise<void> {
    await Promise.all(
      userIds.flatMap((userId) => [
        this.#cache.del(NudgeCountCacheKey.received(userId.value)),
        this.#cache.del(NudgeCountCacheKey.sent(userId.value)),
      ]),
    );
  }
}
