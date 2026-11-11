import { Logger } from "@nestjs/common";
import { escapeRegExp } from "es-toolkit";
import { LRUCache } from "lru-cache";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

import { CacheSingleflight } from "../cache-singleflight.js";
import {
  type CacheEntry,
  type CacheStats,
  CacheStorePort,
  type CacheValueSchema,
  type CacheWrapTtlMs,
} from "../cache-store.port.js";

/** lru-cache는 null·undefined 값을 담지 못해 한 겹 감싼다. */
interface StoredValue {
  readonly value: unknown;
}

/** 프로세스 안 캐시. 크기 상한(`max`)과 TTL은 lru-cache가 지키고, 만료 항목은 읽을 때 지운다. */
export class InMemoryCacheStore extends CacheStorePort {
  readonly #logger = new Logger(InMemoryCacheStore.name);
  readonly #entries: LRUCache<string, StoredValue>;
  readonly #defaultTtlMs: number;
  readonly #singleflight = new CacheSingleflight();
  #hits = 0;
  #misses = 0;

  constructor(options: { readonly defaultTtlMs: number; readonly maxItems: number }) {
    super();
    this.#defaultTtlMs = options.defaultTtlMs;
    this.#entries = new LRUCache({
      max: options.maxItems,
      ttl: options.defaultTtlMs,
      // 만료를 Date.now로 재서 테스트의 가짜 시계(setSystemTime)를 그대로 따른다
      perf: { now: () => Date.now() },
      // 시각을 타이머로 잠깐 캐시하지 않아 만료 판정이 매번 현재 시각을 본다
      ttlResolution: 0,
    });
  }

  async get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined> {
    const stored = this.#entries.get(key);
    if (stored == null) {
      this.#misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "miss" });
      return undefined;
    }
    const parsed = schema.safeParse(stored.value);
    if (!parsed.success) {
      this.#entries.delete(key);
      this.#misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "invalid" });
      return undefined;
    }
    this.#hits++;
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "hit" });
    return parsed.data;
  }

  async set<T>(key: string, value: T, ttlMs: number = this.#defaultTtlMs): Promise<void> {
    if (ttlMs <= 0) {
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_SKIPPED, key, ttlMs });
      return;
    }
    this.#entries.set(key, { value }, { ttl: ttlMs });
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_WRITTEN, key, ttlMs });
  }

  async del(key: string): Promise<void> {
    if (this.#entries.delete(key)) {
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_DELETED, key });
    }
  }

  async mget<T>(keys: readonly string[], schema: CacheValueSchema<T>): Promise<(T | undefined)[]> {
    return Promise.all(keys.map((key) => this.get(key, schema)));
  }

  async mset<T>(entries: readonly CacheEntry<T>[]): Promise<void> {
    await Promise.all(entries.map(({ key, value, ttlMs }) => this.set(key, value, ttlMs)));
  }

  async delByPattern(pattern: string): Promise<number> {
    const matcher = new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`);
    const matched = [...this.#entries.keys()].filter((key) => matcher.test(key));
    for (const key of matched) {
      this.#entries.delete(key);
    }
    this.#logger.debug({
      event: PlatformLogEvent.CACHE_PATTERN_DELETED,
      pattern,
      count: matched.length,
    });
    return matched.length;
  }

  wrap<T>(
    key: string,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs?: CacheWrapTtlMs<T>,
  ): Promise<T> {
    return this.#singleflight.wrap(this, key, schema, factory, ttlMs);
  }

  async has(key: string): Promise<boolean> {
    return this.#entries.has(key);
  }

  async ttl(key: string): Promise<number> {
    return this.#entries.has(key) ? this.#entries.getRemainingTTL(key) : -2;
  }

  async touch(key: string, ttlMs: number): Promise<boolean> {
    const stored = this.#entries.get(key);
    if (stored == null) {
      return false;
    }
    this.#entries.set(key, stored, { ttl: ttlMs });
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_TOUCHED, key, ttlMs });
    return true;
  }

  async reset(): Promise<void> {
    const count = this.#entries.size;
    this.#entries.clear();
    this.#hits = 0;
    this.#misses = 0;
    this.#logger.debug({ event: PlatformLogEvent.CACHE_RESET, count });
  }

  getStats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses, keys: this.#entries.size };
  }
}
