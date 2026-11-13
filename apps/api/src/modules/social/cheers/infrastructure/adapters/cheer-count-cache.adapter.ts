import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  CheerCountCachePort,
  ReceivedCheerCounts,
} from "../../application/ports/cheer-count-cache.port.js";
import {
  CHEER_COUNT_CACHE_TTL_MS,
  CheerCountCacheKey,
} from "../cache/cheer-count-cache.keyspace.js";

const RECEIVED_COUNTS_SCHEMA = z.object({ total: z.number(), unread: z.number() });

@Injectable()
export class CheerCountCacheAdapter implements CheerCountCachePort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  wrapReceivedCounts(
    userId: UserId,
    factory: () => Promise<ReceivedCheerCounts>,
  ): Promise<ReceivedCheerCounts> {
    return this.#cache.wrap(
      CheerCountCacheKey.received(userId.value),
      RECEIVED_COUNTS_SCHEMA,
      factory,
      CHEER_COUNT_CACHE_TTL_MS,
    );
  }

  wrapSentCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    return this.#cache.wrap(
      CheerCountCacheKey.sent(userId.value),
      z.number(),
      factory,
      CHEER_COUNT_CACHE_TTL_MS,
    );
  }

  async invalidate(userIds: readonly UserId[]): Promise<void> {
    await Promise.all(
      userIds.flatMap((userId) => [
        this.#cache.del(CheerCountCacheKey.received(userId.value)),
        this.#cache.del(CheerCountCacheKey.sent(userId.value)),
      ]),
    );
  }
}
