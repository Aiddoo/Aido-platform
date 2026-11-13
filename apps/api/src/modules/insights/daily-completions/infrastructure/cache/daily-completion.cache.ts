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
import { DailyCompletion } from "../../domain/daily-completion.entity.js";
import { DateRange } from "../../domain/date-range.vo.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DAILY_COMPLETION_GENERATION_TTL_MS,
  DailyCompletionCacheKey,
} from "./daily-completion.keyspace.js";

const PLAIN_DATE_SCHEMA = z.iso.date().transform((value) => Temporal.PlainDate.from(value));

// 배포 사이 이전·다음 버전이 같은 키를 읽으므로 저장 모양은 응답 계약과 같은 JSON 그대로 둔다
const CACHED_RANGE_SCHEMA = z.object({
  completions: z.array(
    z.object({
      date: PLAIN_DATE_SCHEMA,
      totalTodos: z.number(),
      completedTodos: z.number(),
      isComplete: z.boolean(),
      completionRate: z.number(),
      categoryColors: z.array(z.string()),
    }),
  ),
  totalCompleteDays: z.number(),
  // 여러 날 할 일을 시작일에만 세던 이전 값은 기간이 남아 있어 미스로 보고 다시 센다
  multiDayTodos: z.array(z.unknown()).max(0).optional(),
  dateRange: z.object({ startDate: PLAIN_DATE_SCHEMA, endDate: PLAIN_DATE_SCHEMA }),
});

type CachedRange = z.infer<typeof CACHED_RANGE_SCHEMA>;

function toCachedJson(value: DailyCompletionRange) {
  return {
    completions: value.completions.map((completion) => ({
      date: completion.date.toString(),
      totalTodos: completion.totalTodos,
      completedTodos: completion.completedTodos,
      isComplete: completion.isComplete,
      completionRate: completion.completionRate,
      categoryColors: [...completion.categoryColors],
    })),
    totalCompleteDays: value.totalCompleteDays,
    multiDayTodos: [],
    dateRange: { startDate: value.range.start.toString(), endDate: value.range.end.toString() },
  };
}

function toDailyCompletionRange(userId: UserId, cached: CachedRange): DailyCompletionRange {
  return {
    range: DateRange.create(cached.dateRange.startDate, cached.dateRange.endDate),
    completions: cached.completions.map((completion) =>
      DailyCompletion.reconstitute({
        userId: userId.value,
        date: completion.date,
        totalTodos: completion.totalTodos,
        completedTodos: completion.completedTodos,
        categoryColors: completion.categoryColors,
      }),
    ),
    totalCompleteDays: cached.totalCompleteDays,
  };
}

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
    const cached = await this.#cache.get(keyForGeneration(generation), CACHED_RANGE_SCHEMA);
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
    await this.#cache.set(key, toCachedJson(value), DAILY_COMPLETION_CACHE_TTL_MS);
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
