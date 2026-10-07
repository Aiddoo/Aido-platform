import type { DailyCompletionsRange } from "../../../domain/policies/daily-completions/daily-completion.js";

/** DailyCompletionCachePort DI 토큰 */
export const DAILY_COMPLETION_CACHE = Symbol("DAILY_COMPLETION_CACHE");

export interface DailyCompletionCachePort {
  getRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionsRange | undefined>;

  setRange(
    userId: string,
    startDate: string,
    endDate: string,
    value: DailyCompletionsRange,
  ): Promise<void>;

  /** 친구에게 보이는 공개(PUBLIC) 범위 캐시 — 키는 소유자 기준이라 뷰어 무관 공유. */
  getPublicRange(
    ownerUserId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCompletionsRange | undefined>;

  setPublicRange(
    ownerUserId: string,
    startDate: string,
    endDate: string,
    value: DailyCompletionsRange,
  ): Promise<void>;

  /** 해당 사용자의 모든 범위 캐시(공개 범위 포함)를 무효화한다. */
  invalidate(userId: string): Promise<void>;
}
