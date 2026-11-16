import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestion.constants.js";

/** 제안 분석에 넣는 사용자 활동 projection. 기간은 사용자 시간대의 날짜로 자른다. */
export abstract class SuggestionActivityReaderPort {
  abstract findRecentTodos(
    userId: UserId,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]>;
  /** 최근에 응답한 것부터. 프롬프트는 같은 활동의 가장 최근 응답만 남긴다 */
  abstract findRecentResponded(userId: UserId, since: Date): Promise<SuggestionHistoryItem[]>;
}
