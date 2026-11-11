import { Logger } from "@nestjs/common";
import type { Redis } from "ioredis";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler.js";
import { CacheSingleflight } from "../cache-singleflight.js";
import {
  type CacheEntry,
  type CacheStats,
  CacheStorePort,
  type CacheValueSchema,
  type CacheWrapTtlMs,
} from "../cache-store.port.js";

const KEY_PREFIX = "cache:";
const SCAN_COUNT = 100;

/**
 * Redis·Valkey 캐시. 값은 JSON 문자열로 `cache:` 아래에 두고 패턴 삭제는 KEYS 대신 SCAN으로 한다.
 * 장애는 fail-open이고 오류 로그는 RedisErrorLogSampler로 시간 창마다 한 번만 남긴다.
 */
export class RedisCacheStore extends CacheStorePort {
  readonly #logger = new Logger(RedisCacheStore.name);
  readonly #redis: Redis;
  readonly #defaultTtlMs: number;
  readonly #errorSampler: RedisErrorLogSampler;
  readonly #singleflight = new CacheSingleflight();
  #hits = 0;
  #misses = 0;

  constructor(redis: Redis, defaultTtlMs: number, errorSampler?: RedisErrorLogSampler) {
    super();
    this.#redis = redis;
    this.#defaultTtlMs = defaultTtlMs;
    this.#errorSampler = errorSampler ?? new RedisErrorLogSampler(this.#logger);
    this.#logger.log({ event: PlatformLogEvent.CACHE_INITIALIZED, provider: "redis" });
  }

  get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined> {
    return this.#failOpen(
      "GET",
      async () => this.#decode(key, await this.#redis.get(KEY_PREFIX + key), schema),
      undefined,
    );
  }

  async set<T>(key: string, value: T, ttlMs: number = this.#defaultTtlMs): Promise<void> {
    if (ttlMs <= 0) {
      return;
    }
    await this.#failOpen(
      "SET",
      async () => {
        await this.#redis.set(KEY_PREFIX + key, JSON.stringify(value), "PX", ttlMs);
      },
      undefined,
    );
  }

  async del(key: string): Promise<void> {
    await this.#failOpen(
      "DEL",
      async () => {
        await this.#redis.del(KEY_PREFIX + key);
      },
      undefined,
    );
  }

  async mget<T>(keys: readonly string[], schema: CacheValueSchema<T>): Promise<(T | undefined)[]> {
    if (keys.length === 0) {
      return [];
    }
    return this.#failOpen(
      "MGET",
      async () => {
        const values = await this.#redis.mget(...keys.map((key) => KEY_PREFIX + key));
        return keys.map((key, index) => this.#decode(key, values[index] ?? null, schema));
      },
      keys.map(() => undefined),
    );
  }

  async mset<T>(entries: readonly CacheEntry<T>[]): Promise<void> {
    const writes = entries
      .map(({ key, value, ttlMs = this.#defaultTtlMs }) => ({ key, value, ttlMs }))
      .filter(({ ttlMs }) => ttlMs > 0);
    if (writes.length === 0) {
      return;
    }
    await this.#failOpen(
      "MSET",
      async () => {
        const pipeline = this.#redis.pipeline();
        for (const { key, value, ttlMs } of writes) {
          pipeline.set(KEY_PREFIX + key, JSON.stringify(value), "PX", ttlMs);
        }
        await pipeline.exec();
      },
      undefined,
    );
  }

  async delByPattern(pattern: string): Promise<number> {
    const progress = { deleted: 0 };
    try {
      await this.#deleteMatching(KEY_PREFIX + pattern, progress);
    } catch (error) {
      // 지운 만큼만 돌려준다. 남은 키는 TTL로 사라진다
      this.#errorSampler.warn("DEL_PATTERN", error);
      return progress.deleted;
    }
    this.#logger.debug({
      event: PlatformLogEvent.CACHE_PATTERN_DELETED,
      pattern,
      count: progress.deleted,
    });
    return progress.deleted;
  }

  wrap<T>(
    key: string,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs?: CacheWrapTtlMs<T>,
  ): Promise<T> {
    return this.#singleflight.wrap(this, key, schema, factory, ttlMs);
  }

  has(key: string): Promise<boolean> {
    return this.#failOpen(
      "EXISTS",
      async () => (await this.#redis.exists(KEY_PREFIX + key)) === 1,
      false,
    );
  }

  ttl(key: string): Promise<number> {
    return this.#failOpen("PTTL", () => this.#redis.pttl(KEY_PREFIX + key), -2);
  }

  touch(key: string, ttlMs: number): Promise<boolean> {
    return this.#failOpen(
      "PEXPIRE",
      async () => (await this.#redis.pexpire(KEY_PREFIX + key, ttlMs)) === 1,
      false,
    );
  }

  async reset(): Promise<void> {
    await this.#failOpen(
      "RESET",
      async () => {
        await this.#deleteMatching(`${KEY_PREFIX}*`, { deleted: 0 });
        this.#hits = 0;
        this.#misses = 0;
        this.#logger.debug({ event: PlatformLogEvent.CACHE_RESET });
      },
      undefined,
    );
  }

  getStats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses, keys: -1 };
  }

  async #deleteMatching(fullPattern: string, progress: { deleted: number }): Promise<void> {
    let cursor = "0";
    do {
      const [next, keys] = await this.#redis.scan(
        cursor,
        "MATCH",
        fullPattern,
        "COUNT",
        SCAN_COUNT,
      );
      cursor = next;
      if (keys.length > 0) {
        progress.deleted += await this.#redis.del(...keys);
      }
    } while (cursor !== "0");
  }

  #decode<T>(key: string, data: string | null, schema: CacheValueSchema<T>): T | undefined {
    if (data == null) {
      this.#misses++;
      return undefined;
    }
    const parsed = schema.safeParse(JSON.parse(data));
    if (!parsed.success) {
      this.#misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "invalid" });
      return undefined;
    }
    this.#hits++;
    return parsed.data;
  }

  async #failOpen<T>(operation: string, action: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.#errorSampler.warn(operation, error);
      return fallback;
    }
  }
}
