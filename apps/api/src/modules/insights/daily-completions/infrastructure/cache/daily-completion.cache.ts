import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  DailyCompletionCachePort,
  DailyCompletionCacheRead,
} from "../../application/ports/daily-completion-cache.port.js";
import type { DailyCompletionRange } from "../../application/read-models/daily-completion-range.read-model.js";
import type { DateRange } from "../../domain/date-range.vo.js";
import {
  DAILY_COMPLETION_RANGE_ROW_SCHEMA,
  toDailyCompletionRange,
  toDailyCompletionRangeRow,
} from "./daily-completion-cache.mapper.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DAILY_COMPLETION_GENERATION_TTL_MS,
  DailyCompletionCacheKey,
} from "./daily-completion.keyspace.js";

@Injectable()
export class DailyCompletionCache implements DailyCompletionCachePort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  readRange(userId: UserId, range: DateRange): Promise<DailyCompletionCacheRead> {
    return this.#read(userId, (generation) =>
      DailyCompletionCacheKey.range(
        userId.value,
        generation,
        range.start.toString(),
        range.end.toString(),
      ),
    );
  }

  storeRangeIfCurrent(
    userId: UserId,
    generation: string,
    value: DailyCompletionRange,
  ): Promise<void> {
    return this.#storeIfCurrent(
      userId,
      generation,
      DailyCompletionCacheKey.range(
        userId.value,
        generation,
        value.range.start.toString(),
        value.range.end.toString(),
      ),
      value,
    );
  }

  readPublicRange(ownerUserId: UserId, range: DateRange): Promise<DailyCompletionCacheRead> {
    return this.#read(ownerUserId, (generation) =>
      DailyCompletionCacheKey.publicRange(
        ownerUserId.value,
        generation,
        range.start.toString(),
        range.end.toString(),
      ),
    );
  }

  storePublicRangeIfCurrent(
    ownerUserId: UserId,
    generation: string,
    value: DailyCompletionRange,
  ): Promise<void> {
    return this.#storeIfCurrent(
      ownerUserId,
      generation,
      DailyCompletionCacheKey.publicRange(
        ownerUserId.value,
        generation,
        value.range.start.toString(),
        value.range.end.toString(),
      ),
      value,
    );
  }

  async invalidate(userId: UserId): Promise<void> {
    // 세대를 회전하면 이전 범위 값은 닿지 않고 값 TTL(10분)에 사라진다. 키 전체 SCAN을 기다리지 않는다
    await this.#cache.set(
      DailyCompletionCacheKey.generation(userId.value),
      randomUUID(),
      DAILY_COMPLETION_GENERATION_TTL_MS,
    );
  }

  async #read(
    userId: UserId,
    keyForGeneration: (generation: string) => string,
  ): Promise<DailyCompletionCacheRead> {
    const generation = await this.#getGeneration(userId);
    const cached = await this.#cache.get(
      keyForGeneration(generation),
      DAILY_COMPLETION_RANGE_ROW_SCHEMA,
    );
    const verifiedGeneration = await this.#getGeneration(userId);

    if (verifiedGeneration !== generation) {
      return { generation: verifiedGeneration, value: null };
    }
    return { generation, value: cached == null ? null : toDailyCompletionRange(userId, cached) };
  }

  async #storeIfCurrent(
    userId: UserId,
    generation: string,
    key: string,
    value: DailyCompletionRange,
  ): Promise<void> {
    if ((await this.#getGeneration(userId)) !== generation) {
      return;
    }
    // 검사 직후 무효화되어도 캡처한 세대 namespace에만 저장한다.
    await this.#cache.set(key, toDailyCompletionRangeRow(value), DAILY_COMPLETION_CACHE_TTL_MS);
  }

  async #getGeneration(userId: UserId): Promise<string> {
    const key = DailyCompletionCacheKey.generation(userId.value);
    const cachedGeneration = await this.#cache.get(key, z.string());
    if (cachedGeneration != null) {
      return cachedGeneration;
    }

    const generation = randomUUID();
    await this.#cache.set(key, generation, DAILY_COMPLETION_GENERATION_TTL_MS);
    return generation;
  }
}
