import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Suggestion } from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { GetPendingSuggestions } from "./get-pending-suggestions.use-case.js";

const mockUserId = "user-123";

function createSuggestion(): Suggestion {
  return Suggestion.reconstitute({
    id: 1,
    userId: mockUserId,
    title: "팀 미팅",
    daysOfWeek: ["MON", "WED", "FRI"],
    scheduledTime: "10:00",
    confidence: 0.85,
    reason: "이유",
    matchedTodos: [],
    status: "PENDING",
    suggestedCategoryId: 3,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    createdAt: new Date("2026-03-04T00:00:00.000Z"),
    updatedAt: new Date("2026-03-04T00:00:00.000Z"),
  });
}

describe("GetPendingSuggestions", () => {
  let useCase: GetPendingSuggestions;
  let repo: Mocked<AiSuggestionRepositoryPort>;
  let entitlement: Mocked<EntitlementService>;

  beforeEach(async () => {
    const getPendingSuggestionsDependencies = mockDeep<
      ConstructorParameters<typeof GetPendingSuggestions>[0]
    >({});
    const unit = new GetPendingSuggestions(getPendingSuggestionsDependencies);

    useCase = unit;
    repo = getPendingSuggestionsDependencies.repository;
    entitlement = getPendingSuggestionsDependencies.entitlementService;

    entitlement.hasPremiumAccess.mockResolvedValue(true);
  });

  it("비프리미엄 사용자면 AI_1309 예외를 던지고 조회하지 않아야 한다", async () => {
    entitlement.hasPremiumAccess.mockResolvedValue(false);

    await expect(useCase.execute(mockUserId)).rejects.toBeInstanceOf(ApplicationException);
    expect(repo.findPendingByUserId).not.toHaveBeenCalled();
  });

  it("프리미엄 사용자면 대기 중인 제안 목록을 반환해야 한다", async () => {
    repo.findPendingByUserId.mockResolvedValue([createSuggestion()]);

    const result = await useCase.execute(mockUserId);

    expect(repo.findPendingByUserId).toHaveBeenCalledWith(mockUserId);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });
});
