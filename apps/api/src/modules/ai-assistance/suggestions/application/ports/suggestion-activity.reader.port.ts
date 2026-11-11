import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  CategoryCompletionRate,
  DayCompletionRate,
  SuggestionHistoryItem,
  TimeCompletionRate,
  TodoSummaryForAnalysis,
  UserStreakInfo,
} from "../../domain/suggestion.constants.js";

/** 제안 분석에 넣는 사용자 활동 projection. 기간은 사용자 시간대의 날짜로 자른다. */
export abstract class SuggestionActivityReaderPort {
  abstract findDayCompletionRates(
    userId: UserId,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<DayCompletionRate[]>;
  abstract findTimeCompletionRates(
    userId: UserId,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TimeCompletionRate>;
  abstract findCategoryCompletionRates(
    userId: UserId,
    from: Date,
    to: Date,
    timezone?: string,
  ): Promise<CategoryCompletionRate[]>;
  abstract findUserStreakInfo(userId: UserId): Promise<UserStreakInfo | null>;
  abstract findRecentTodos(
    userId: UserId,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]>;
  abstract findRecentResponded(userId: UserId, since: Date): Promise<SuggestionHistoryItem[]>;
}
