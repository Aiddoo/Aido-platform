import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionAnalysisPeriod } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestions.constants.js";

/** 제안 분석에 넣는 사용자 활동 projection. 기간은 사용자 시간대의 현지 날짜다. */
export abstract class SuggestionActivityReaderPort {
  // 시간대는 시각이 있는 할 일의 벽시계를 읽는 데 쓴다
  abstract findRecentTodos(
    userId: UserId,
    period: SuggestionAnalysisPeriod,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]>;
  /** 최근에 응답한 것부터. 프롬프트는 같은 활동의 가장 최근 응답만 남긴다 */
  abstract findRecentResponded(
    userId: UserId,
    since: Temporal.Instant,
  ): Promise<SuggestionHistoryItem[]>;
}
