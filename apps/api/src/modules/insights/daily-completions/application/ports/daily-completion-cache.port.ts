import type { DailyCompletionsRange } from "../../domain/daily-completion.read-model.js";

export const DAILY_COMPLETION_CACHE = Symbol("DAILY_COMPLETION_CACHE");

export interface DailyCompletionCacheRead {
  readonly generation: string;
  readonly value: DailyCompletionsRange | undefined;
}

export interface DailyCompletionCachePort {
  readRange(userId: string, startDate: string, endDate: string): Promise<DailyCompletionCacheRead>;
  storeRangeIfCurrent(
    userId: string,
    startDate: string,
    endDate: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void>;
  readPublicRange(
    ownerUserId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionCacheRead>;
  storePublicRangeIfCurrent(
    ownerUserId: string,
    startDate: string,
    endDate: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void>;
  invalidate(userId: string): Promise<void>;
}
