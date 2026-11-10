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
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<DayCompletionRate[]>;
  abstract findTimeCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TimeCompletionRate>;
  abstract findCategoryCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone?: string,
  ): Promise<CategoryCompletionRate[]>;
  abstract findUserStreakInfo(userId: string): Promise<UserStreakInfo | null>;
  abstract findRecentTodos(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]>;
  abstract findRecentResponded(userId: string, since: Date): Promise<SuggestionHistoryItem[]>;
}
