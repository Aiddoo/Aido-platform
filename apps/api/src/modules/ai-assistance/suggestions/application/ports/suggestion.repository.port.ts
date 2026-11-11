import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionId } from "../../domain/suggestion-id.vo.js";
import type { Suggestion } from "../../domain/suggestion.aggregate.js";

/** RecurringSuggestion 저장소. 트랜잭션은 CLS로 전파된다. */
export abstract class SuggestionRepositoryPort {
  abstract nextIds(count: number): Promise<SuggestionId[]>;
  abstract saveMany(suggestions: readonly Suggestion[]): Promise<void>;
  abstract save(suggestion: Suggestion): Promise<void>;
  abstract findByIdAndUserId(
    suggestionId: SuggestionId,
    userId: UserId,
  ): Promise<Suggestion | null>;
  /** now에 만료되지 않은 대기 제안. 만든 시각 내림차순 */
  abstract listPendingByUserId(userId: UserId, now: Temporal.Instant): Promise<Suggestion[]>;
  /** 지운 수 */
  abstract deletePendingByUserId(userId: UserId): Promise<number>;
  /** now 전에 만료된 제안을 상태와 상관없이 지운다. 지운 수 */
  abstract deleteExpiredByUserId(userId: UserId, now: Temporal.Instant): Promise<number>;
}
