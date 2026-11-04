import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";

import { PlatformLogEvent } from "#api/platform/logging/platform-log.events";

import {
  type CacheStats,
  type CacheValueSchema,
  type ICacheService,
  parseTtl,
  resolveWrapTtl,
  type TtlValue,
  type WrapTtl,
} from "../interfaces/cache.interface.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number; // timestamp
}

/**
 * 인메모리 캐시 어댑터
 *
 * - Map 기반 저장소
 * - TTL 지원 (숫자 밀리초 + shorthand 문자열)
 * - FIFO 방식 Eviction (maxItems 초과 시)
 * - 30초마다 만료된 항목 자동 정리
 * - wrap, mget, mset, has, ttl, touch 메서드 지원
 */
@Injectable()
export class InMemoryCacheAdapter implements ICacheService, OnModuleDestroy {
  readonly #logger = new Logger(InMemoryCacheAdapter.name);
  readonly #cache = new Map<string, CacheEntry>();
  readonly #defaultTtlMs: number;
  readonly #maxItems: number;
  readonly #inflight = new Map<string, Promise<unknown>>();

  #stats = { hits: 0, misses: 0 };
  #cleanupInterval: NodeJS.Timeout;

  constructor(config: { defaultTtlMs: number; maxItems: number; cleanupIntervalMs?: number }) {
    this.#defaultTtlMs = config.defaultTtlMs;
    this.#maxItems = config.maxItems;

    const cleanupInterval = config.cleanupIntervalMs ?? 30_000;

    if (cleanupInterval < 1000) {
      throw new Error(
        `cleanupIntervalMs must be at least 1000ms (1 second), got ${cleanupInterval}ms`,
      );
    }

    this.#cleanupInterval = setInterval(() => this.#cleanup(), cleanupInterval);
  }

  onModuleDestroy() {
    clearInterval(this.#cleanupInterval);
  }

  async get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined> {
    const entry = this.#cache.get(key);

    if (!entry) {
      this.#stats.misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "miss" });
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      this.#stats.misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "expired" });
      return undefined;
    }

    const parsed = schema.safeParse(entry.value);
    if (!parsed.success) {
      this.#cache.delete(key);
      this.#stats.misses++;
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "invalid" });
      return undefined;
    }

    this.#stats.hits++;
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_READ, key, result: "hit" });
    return parsed.data;
  }

  async set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
    // TTL이 0이면 즉시 만료 (저장하지 않음)
    if (ttl === 0) {
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_SKIPPED, key, ttlMs: 0 });
      return;
    }

    // FIFO: 최대 항목 수 초과 시 가장 먼저 삽입된 항목 삭제
    if (this.#cache.size >= this.#maxItems) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey) {
        this.#cache.delete(oldestKey);
        this.#logger.debug({
          event: PlatformLogEvent.CACHE_ENTRY_EVICTED,
          key: oldestKey,
          reason: "max-items",
        });
      }
    }

    const ttlMs = ttl != null ? parseTtl(ttl) : this.#defaultTtlMs;
    const expiresAt = Date.now() + ttlMs;
    this.#cache.set(key, { value, expiresAt });
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_WRITTEN, key, ttlMs });
  }

  async del(key: string): Promise<void> {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_DELETED, key });
    }
  }

  async delByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    let count = 0;

    for (const key of this.#cache.keys()) {
      if (regex.test(key)) {
        this.#cache.delete(key);
        count++;
      }
    }

    this.#logger.debug({ event: PlatformLogEvent.CACHE_PATTERN_DELETED, pattern, count });
    return count;
  }

  async reset(): Promise<void> {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#stats = { hits: 0, misses: 0 };
    this.#logger.debug({ event: PlatformLogEvent.CACHE_RESET, count: size });
  }

  getStats(): CacheStats {
    return {
      ...this.#stats,
      keys: this.#cache.size,
      memoryUsage: this.#estimateMemoryUsage(),
    };
  }

  async wrap<T>(
    key: string,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttl?: WrapTtl<T>,
  ): Promise<T> {
    const cached = await this.get(key, schema);
    // nullish-strict: undefined는 cache miss, null은 저장해 둔 값이다
    if (cached !== undefined) {
      return cached;
    }

    // Singleflight: 동일 key에 대한 동시 요청은 하나의 factory만 실행.
    // Note: get()과 inflight 체크 사이에 레이스가 존재할 수 있으나,
    // factory는 멱등이므로 중복 실행은 성능 낭비일 뿐 정합성 문제 없음.
    // factory 에러 시 대기 중인 모든 요청에 동일 에러 전파 (의도된 동작).
    const existing = this.#inflight.get(key);
    if (existing) {
      return existing.then((value) => schema.parse(value));
    }

    const promise = factory()
      .then(async (value) => {
        if (value != null) {
          await this.set(key, value, resolveWrapTtl(ttl, value));
        }
        return value;
      })
      .finally(() => {
        this.#inflight.delete(key);
      });

    this.#inflight.set(key, promise);
    return promise;
  }

  async mget<T>(keys: string[], schema: CacheValueSchema<T>): Promise<(T | undefined)[]> {
    return Promise.all(keys.map((key) => this.get(key, schema)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: TtlValue }>): Promise<void> {
    await Promise.all(entries.map(({ key, value, ttl }) => this.set(key, value, ttl)));
  }

  async has(key: string): Promise<boolean> {
    const entry = this.#cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return false;
    }

    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.#cache.get(key);

    // 키가 없으면 -2 (Redis PTTL 규칙)
    if (!entry) {
      return -2;
    }

    const remaining = entry.expiresAt - Date.now();

    if (remaining <= 0) {
      this.#cache.delete(key);
      return -2;
    }

    return remaining;
  }

  async touch(key: string, ttl: TtlValue): Promise<boolean> {
    const entry = this.#cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return false;
    }

    const ttlMs = parseTtl(ttl);
    entry.expiresAt = Date.now() + ttlMs;
    this.#logger.debug({ event: PlatformLogEvent.CACHE_ENTRY_TOUCHED, key, ttlMs });

    return true;
  }

  #cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.#cache.entries()) {
      if (now > entry.expiresAt) {
        this.#cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug({ event: PlatformLogEvent.CACHE_EXPIRED_CLEANED, count: cleaned });
    }
  }

  #estimateMemoryUsage(): number {
    // 대략적인 메모리 사용량 추정 (정확하지 않음)
    let size = 0;
    for (const [key, entry] of this.#cache.entries()) {
      size += key.length * 2; // UTF-16
      size += JSON.stringify(entry.value).length * 2;
      size += 8; // expiresAt (number)
    }
    return size;
  }
}
