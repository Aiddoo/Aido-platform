import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  type CacheStorePort,
  type CacheValueSchema,
  type CacheWrapTtlMs,
  resolveWrapTtlMs,
} from "./cache-store.port.js";

export interface GenerationGuardedCacheKey {
  readonly valueKey: string;
  /** 무효화할 때마다 바뀌는 세대 키. 없으면 처음 세대다 */
  readonly generationKey: string;
}

const INITIAL_GENERATION = "initial";

/**
 * 쓰기 커밋 전에 읽은 값을 커밋 뒤 무효화 다음에 다시 저장하지 않는 cache-aside.
 * 무효화는 세대를 먼저 바꾸고 값을 지운다. 미스는 factory 전에 세대를 읽어 두고 그대로일 때만 저장하며,
 * 확인과 저장 사이에 무효화가 끼면 저장한 뒤 다시 확인해 방금 쓴 값을 지운다.
 * 세대 TTL은 factory 한 번보다 충분히 길기만 하면 된다(만료되면 처음 세대로 읽어 저장을 건너뛴다).
 */
export class GenerationGuardedCache {
  readonly #store: Pick<CacheStorePort, "get" | "set" | "del">;
  readonly #generationTtlMs: number;

  constructor(store: Pick<CacheStorePort, "get" | "set" | "del">, generationTtlMs: number) {
    this.#store = store;
    this.#generationTtlMs = generationTtlMs;
  }

  async wrap<T>(
    key: GenerationGuardedCacheKey,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs: CacheWrapTtlMs<T>,
  ): Promise<T> {
    const cached = await this.#store.get(key.valueKey, schema);
    // oxlint-disable-next-line aido/no-strict-nullish -- undefined는 cache miss, null은 저장해 둔 값이다
    if (cached !== undefined) {
      return cached;
    }

    const generation = await this.#generation(key);
    const value = await factory();
    if (value == null || (await this.#generation(key)) !== generation) {
      return value;
    }
    await this.#store.set(key.valueKey, value, resolveWrapTtlMs(ttlMs, value));
    if ((await this.#generation(key)) !== generation) {
      await this.#store.del(key.valueKey);
    }
    return value;
  }

  async invalidate(key: GenerationGuardedCacheKey): Promise<void> {
    await this.#store.set(key.generationKey, randomUUID(), this.#generationTtlMs);
    await this.#store.del(key.valueKey);
  }

  async #generation(key: GenerationGuardedCacheKey): Promise<string> {
    return (await this.#store.get(key.generationKey, z.string())) ?? INITIAL_GENERATION;
  }
}
