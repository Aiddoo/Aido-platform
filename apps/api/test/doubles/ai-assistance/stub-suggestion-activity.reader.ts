import { SuggestionActivityReaderPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion-activity.reader.port";
import type {
  CategoryCompletionRate,
  DayCompletionRate,
  SuggestionHistoryItem,
  TimeCompletionRate,
  TodoSummaryForAnalysis,
  UserStreakInfo,
} from "#api/modules/ai-assistance/suggestions/domain/suggestion.constants";

export class StubSuggestionActivityReader extends SuggestionActivityReaderPort {
  todos: TodoSummaryForAnalysis[] = [];
  streak: UserStreakInfo | null = { currentStreak: 3, longestStreak: 5 };
  history: SuggestionHistoryItem[] = [];

  async findDayCompletionRates(): Promise<DayCompletionRate[]> {
    return [{ day: "MON", total: 5, completed: 4 }];
  }

  async findTimeCompletionRates(): Promise<TimeCompletionRate> {
    return { morning: { count: 5, rate: 80 }, afternoon: { count: 0, rate: 0 } };
  }

  async findCategoryCompletionRates(): Promise<CategoryCompletionRate[]> {
    return [{ name: "독서", total: 5, completed: 4, rate: 80 }];
  }

  async findUserStreakInfo(): Promise<UserStreakInfo | null> {
    return this.streak;
  }

  async findRecentTodos(): Promise<TodoSummaryForAnalysis[]> {
    return structuredClone(this.todos);
  }

  async findRecentResponded(): Promise<SuggestionHistoryItem[]> {
    return structuredClone(this.history);
  }
}
