import { Injectable } from "@nestjs/common";

import {
  type CacheEntry,
  type CacheStats,
  CacheStorePort,
  type CacheValueSchema,
  type CacheWrapTtlMs,
} from "./cache-store.port.js";

/** CacheStorePort에 그대로 위임한다. planning·notification·identity·access·social 어댑터가 CacheStorePort로 옮기면 지운다. */
@Injectable()
export class CacheService {
  readonly #store: CacheStorePort;

  constructor(store: CacheStorePort) {
    this.#store = store;
  }

  get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined> {
    return this.#store.get(key, schema);
  }

  set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.#store.set(key, value, ttlMs);
  }

  del(key: string): Promise<void> {
    return this.#store.del(key);
  }

  delByPattern(pattern: string): Promise<number> {
    return this.#store.delByPattern(pattern);
  }

  reset(): Promise<void> {
    return this.#store.reset();
  }

  getStats(): CacheStats {
    return this.#store.getStats();
  }

  wrap<T>(
    key: string,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs?: CacheWrapTtlMs<T>,
  ): Promise<T> {
    return this.#store.wrap(key, schema, factory, ttlMs);
  }

  mget<T>(keys: readonly string[], schema: CacheValueSchema<T>): Promise<(T | undefined)[]> {
    return this.#store.mget(keys, schema);
  }

  mset<T>(entries: readonly CacheEntry<T>[]): Promise<void> {
    return this.#store.mset(entries);
  }

  has(key: string): Promise<boolean> {
    return this.#store.has(key);
  }

  ttl(key: string): Promise<number> {
    return this.#store.ttl(key);
  }

  touch(key: string, ttlMs: number): Promise<boolean> {
    return this.#store.touch(key, ttlMs);
  }
}
