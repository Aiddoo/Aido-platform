import {
  type CacheEntry,
  type CacheStats,
  CacheStorePort,
  type CacheValueSchema,
  type CacheWrapTtlMs,
} from "#api/platform/cache/cache-store.port";

// 아무것도 저장하지 않고 늘 미스로 읽는다. 무효화 계약을 확인하도록 wrap·del 키만 남긴다
export class NoCacheStore extends CacheStorePort {
  readonly wrapped: { readonly key: string; readonly ttlMs: number | "by-value" | undefined }[] =
    [];
  readonly deletedKeys: string[] = [];

  forgetRecords(): void {
    this.wrapped.length = 0;
    this.deletedKeys.length = 0;
  }

  async get<T>(_key: string, _schema: CacheValueSchema<T>): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {}

  async del(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }

  async mget<T>(keys: readonly string[], _schema: CacheValueSchema<T>): Promise<(T | undefined)[]> {
    return keys.map(() => undefined);
  }

  async mset<T>(_entries: readonly CacheEntry<T>[]): Promise<void> {}

  async delByPattern(): Promise<number> {
    return 0;
  }

  wrap<T>(
    key: string,
    _schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs?: CacheWrapTtlMs<T>,
  ): Promise<T> {
    this.wrapped.push({ key, ttlMs: typeof ttlMs === "function" ? "by-value" : ttlMs });
    return factory();
  }

  async has(): Promise<boolean> {
    return false;
  }

  async ttl(): Promise<number> {
    return -2;
  }

  async touch(): Promise<boolean> {
    return false;
  }

  async reset(): Promise<void> {}

  getStats(): CacheStats {
    return { hits: 0, misses: 0, keys: 0 };
  }
}
