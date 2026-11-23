import { SuggestionActivityReaderPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion-activity.reader.port";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "#api/modules/ai-assistance/suggestions/domain/suggestions.constants";

export class StubSuggestionActivityReader extends SuggestionActivityReaderPort {
  todos: TodoSummaryForAnalysis[] = [];
  history: SuggestionHistoryItem[] = [];

  async listRecentTodos(): Promise<TodoSummaryForAnalysis[]> {
    return structuredClone(this.todos);
  }

  async listRecentResponded(): Promise<SuggestionHistoryItem[]> {
    return structuredClone(this.history);
  }
}
