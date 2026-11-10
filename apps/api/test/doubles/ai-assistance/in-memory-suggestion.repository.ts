import { SuggestionRepositoryPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion.repository.port";
import { SuggestionId } from "#api/modules/ai-assistance/suggestions/domain/suggestion-id.vo";
import { Suggestion } from "#api/modules/ai-assistance/suggestions/domain/suggestion.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(suggestion: Suggestion): Suggestion {
  return Suggestion.reconstitute(suggestion.toPrimitives());
}

export class InMemorySuggestionRepository extends SuggestionRepositoryPort {
  readonly #suggestions = new Map<number, Suggestion>();
  #sequence: number;

  constructor(suggestions: readonly Suggestion[] = []) {
    super();
    for (const suggestion of suggestions) {
      this.#suggestions.set(suggestion.id.value, copyOf(suggestion));
    }
    this.#sequence = Math.max(0, ...this.#suggestions.keys());
  }

  get saved(): readonly Suggestion[] {
    return [...this.#suggestions.values()].map(copyOf);
  }

  async nextIds(count: number): Promise<SuggestionId[]> {
    return Array.from({ length: count }, () => {
      this.#sequence += 1;
      return SuggestionId.reconstitute(this.#sequence);
    });
  }

  async saveMany(suggestions: readonly Suggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      await this.save(suggestion);
    }
  }

  async save(suggestion: Suggestion): Promise<void> {
    this.#suggestions.set(suggestion.id.value, copyOf(suggestion));
  }

  async findByIdAndUserId(suggestionId: SuggestionId, userId: UserId): Promise<Suggestion | null> {
    const suggestion = this.#suggestions.get(suggestionId.value);
    return suggestion != null && suggestion.userId.equals(userId) ? copyOf(suggestion) : null;
  }

  // Drizzle 저장소와 같은 순서(만든 시각·id 내림차순)로 나열한다
  async listPendingByUserId(userId: UserId, now: Temporal.Instant): Promise<Suggestion[]> {
    return [...this.#suggestions.values()]
      .filter((suggestion) => suggestion.userId.equals(userId) && suggestion.isPendingAt(now))
      .sort((left, right) => {
        const leftCreatedAt = left.toPrimitives().createdAt;
        const rightCreatedAt = right.toPrimitives().createdAt;
        return (
          Temporal.Instant.compare(rightCreatedAt, leftCreatedAt) || right.id.value - left.id.value
        );
      })
      .map(copyOf);
  }

  async deletePendingByUserId(userId: UserId): Promise<number> {
    return this.#deleteWhere(
      (suggestion) => suggestion.userId.equals(userId) && suggestion.status === "PENDING",
    );
  }

  async deleteExpiredByUserId(userId: UserId, now: Temporal.Instant): Promise<number> {
    return this.#deleteWhere(
      (suggestion) =>
        suggestion.userId.equals(userId) &&
        Temporal.Instant.compare(suggestion.toPrimitives().expiresAt, now) < 0,
    );
  }

  #deleteWhere(predicate: (suggestion: Suggestion) => boolean): number {
    let deleted = 0;
    for (const [id, suggestion] of this.#suggestions) {
      if (predicate(suggestion)) {
        this.#suggestions.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}
