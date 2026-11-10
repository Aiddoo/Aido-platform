import {
  Suggestion,
  type SuggestionPrimitives,
} from "#api/modules/ai-assistance/suggestions/domain/suggestion.aggregate";

export const SUGGESTION_FIXTURE_NOW = Temporal.Instant.from("2026-03-04T00:00:00Z");
export const SUGGESTION_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const SUGGESTION_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";

export function createSuggestionFixture(overrides: Partial<SuggestionPrimitives> = {}): Suggestion {
  return Suggestion.reconstitute({
    id: 1,
    userId: SUGGESTION_FIXTURE_USER_ID,
    title: "팀 미팅",
    daysOfWeek: ["MON", "WED", "FRI"],
    scheduledTime: "10:00",
    confidence: 0.85,
    reason: "매주 월/수/금에 반복되는 패턴이 감지되었습니다.",
    matchedTodos: ["팀 미팅", "팀 회의"],
    suggestedCategoryId: 3,
    status: "PENDING",
    expiresAt: Temporal.Instant.from("2026-03-18T00:00:00Z"),
    createdAt: SUGGESTION_FIXTURE_NOW,
    updatedAt: SUGGESTION_FIXTURE_NOW,
    ...overrides,
  });
}
