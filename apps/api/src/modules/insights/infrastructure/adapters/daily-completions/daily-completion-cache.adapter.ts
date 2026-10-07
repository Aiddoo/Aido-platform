import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import type { DailyCompletionCachePort } from "../../../application/ports/daily-completions/daily-completion-cache.port.js";
import type { DailyCompletionsRange } from "../../../domain/policies/daily-completions/daily-completion.js";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DailyCompletionCacheKey,
} from "../../cache/daily-completions/daily-completion-cache.keyspace.js";

@Injectable()
export class DailyCompletionCacheAdapter implements DailyCompletionCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionsRange | undefined> {
    return this.cacheService.get<DailyCompletionsRange>(
      DailyCompletionCacheKey.range(userId, startDate, endDate),
    );
  }

  setRange(
    userId: string,
    startDate: string,
    endDate: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    return this.cacheService.set(
      DailyCompletionCacheKey.range(userId, startDate, endDate),
      value,
      DAILY_COMPLETION_CACHE_TTL_MS,
    );
  }

  getPublicRange(
    ownerUserId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionsRange | undefined> {
    return this.cacheService.get<DailyCompletionsRange>(
      DailyCompletionCacheKey.publicRange(ownerUserId, startDate, endDate),
    );
  }

  setPublicRange(
    ownerUserId: string,
    startDate: string,
    endDate: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    return this.cacheService.set(
      DailyCompletionCacheKey.publicRange(ownerUserId, startDate, endDate),
      value,
      DAILY_COMPLETION_CACHE_TTL_MS,
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.cacheService.delByPattern(DailyCompletionCacheKey.pattern(userId));
  }
}
