import {
  type CacheStorePort,
  type CacheValueSchema,
  type CacheWrapRequest,
  resolveWrapTtlMs,
} from "./cache-store.port.js";

/**
 * cache-aside 미스에서 같은 key의 factory를 한 번만 부른다. get과 대기 확인 사이 경합으로
 * 드물게 두 번 불릴 수 있으나 factory는 멱등이라 낭비일 뿐이다. factory 오류는 기다리던 호출 모두에 간다.
 */
export class CacheSingleflight {
  readonly #loads = new Map<string, Promise<unknown>>();

  async wrap<T>(
    store: Pick<CacheStorePort, "get" | "set">,
    { key, schema, factory, ttlMs }: CacheWrapRequest<T>,
  ): Promise<T> {
    const cached = await store.get(key, schema);
    // oxlint-disable-next-line aido/no-strict-nullish -- undefined는 cache miss, null은 저장해 둔 값이다
    if (cached !== undefined) {
      return cached;
    }

    return this.coalesce(key, schema, async () => {
      const value = await factory();
      if (value != null) {
        await store.set(key, value, resolveWrapTtlMs(ttlMs, value));
      }
      return value;
    });
  }

  // 같은 key로 진행 중인 load가 있으면 그 결과를 함께 기다린다
  async coalesce<T>(key: string, schema: CacheValueSchema<T>, load: () => Promise<T>): Promise<T> {
    const pending = this.#loads.get(key);
    if (pending != null) {
      return pending.then((value) => schema.parse(value));
    }

    const started = load().finally(() => {
      this.#loads.delete(key);
    });
    this.#loads.set(key, started);
    return started;
  }
}
