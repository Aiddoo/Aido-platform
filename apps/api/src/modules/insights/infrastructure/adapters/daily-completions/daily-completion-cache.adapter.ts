import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import type {
  DailyCompletionCachePort,
  DailyCompletionCacheRead,
} from "../../../application/ports/daily-completions/daily-completion-cache.port.js";
import type { DailyCompletionsRange } from "../../../domain/records/daily-completions/daily-completion.record.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DAILY_COMPLETION_GENERATION_TTL_MS,
  DailyCompletionCacheKey,
} from "../../cache/daily-completions/daily-completion-cache.keyspace.js";

@Injectable()
export class DailyCompletionCacheAdapter implements DailyCompletionCachePort {
  constructor(private readonly cacheService: CacheService) {}

  readRange(userId: string, startDate: string, endDate: string): Promise<DailyCompletionCacheRead> {
    return this.read(userId, (generation) =>
      DailyCompletionCacheKey.range(userId, generation, startDate, endDate),
    );
  }

  storeRangeIfCurrent(
    userId: string,
    startDate: string,
    endDate: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    return this.storeIfCurrent(
      userId,
      generation,
      DailyCompletionCacheKey.range(userId, generation, startDate, endDate),
      value,
    );
  }

  readPublicRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionCacheRead> {
    return this.read(userId, (generation) =>
      DailyCompletionCacheKey.publicRange(userId, generation, startDate, endDate),
    );
  }

  storePublicRangeIfCurrent(
    userId: string,
    startDate: string,
    endDate: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    return this.storeIfCurrent(
      userId,
      generation,
      DailyCompletionCacheKey.publicRange(userId, generation, startDate, endDate),
      value,
    );
  }

  async invalidate(userId: string): Promise<void> {
    const previousGeneration = await this.getGeneration(userId);
    // prefix 삭제부터 이전 세대를 단절한다. 세대 miss는 새 UUID로만 복원한다.
    await this.cacheService.delByPattern(DailyCompletionCacheKey.legacyPattern(userId));
    await this.cacheService.set(
      DailyCompletionCacheKey.generation(userId),
      randomUUID(),
      DAILY_COMPLETION_GENERATION_TTL_MS,
    );
    await this.cacheService.delByPattern(
      DailyCompletionCacheKey.generationPattern(userId, previousGeneration),
    );
  }

  private async read(
    userId: string,
    keyForGeneration: (generation: string) => string,
  ): Promise<DailyCompletionCacheRead> {
    const generation = await this.getGeneration(userId);
    const value = await this.cacheService.get<DailyCompletionsRange>(keyForGeneration(generation));
    const verifiedGeneration = await this.getGeneration(userId);

    return verifiedGeneration === generation
      ? { generation, value }
      : { generation: verifiedGeneration, value: undefined };
  }

  private async storeIfCurrent(
    userId: string,
    generation: string,
    key: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    if ((await this.getGeneration(userId)) !== generation) {
      return;
    }
    // 검사 직후 무효화되어도 캡처한 세대 namespace에만 저장한다.
    await this.cacheService.set(key, value, DAILY_COMPLETION_CACHE_TTL_MS);
  }

  private async getGeneration(userId: string): Promise<string> {
    const key = DailyCompletionCacheKey.generation(userId);
    const cachedGeneration = await this.cacheService.get<string>(key);
    if (cachedGeneration !== undefined) {
      return cachedGeneration;
    }

    const generation = randomUUID();
    await this.cacheService.set(key, generation, DAILY_COMPLETION_GENERATION_TTL_MS);
    return generation;
  }
}
